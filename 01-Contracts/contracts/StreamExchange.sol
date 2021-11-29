// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

// import "hardhat/console.sol";

import {ISuperfluid, ISuperToken, ISuperApp, ISuperAgreement, SuperAppDefinitions} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol"; //"@superfluid-finance/ethereum-monorepo/packages/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {IInstantDistributionAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";

import {SuperAppBase} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./tellor/UsingTellor.sol";

import "./StreamExchangeStorage.sol";
import "./StreamExchangeHelper.sol";
import "./tellor/ITellor.sol";

/// @title StreamExchange SuperApp
/// @notice This contract is an SuperFluid SuperApp
contract StreamExchange is Ownable, SuperAppBase, UsingTellor, Initializable {
    // TODO: uint256 public constant RATE_PERCISION = 1000000;
    using SafeERC20 for ERC20;
    using StreamExchangeHelper for StreamExchangeStorage.StreamExchange;
    using StreamExchangeStorage for StreamExchangeStorage.StreamExchange;
    StreamExchangeStorage.StreamExchange internal _exchange;

    event UpdatedStream(address from, int96 newRate, int96 totalInflow);

    /// @param host is SuperFluid protocol host address
    /// @param cfa is SuperFluid Constant Flow Agreement (CFA) address
    /// @param ida is SuperFluid Instant Distribution Agreement (IDA) address
    /// @param inputToken is input SuperToken address
    /// @param outputToken is input SuperToken address
    /// @param subsidyToken is subsidy SuperToken address
    /// @param sushiRouter is SushiSwap router address
    /// @param oracle is the TellorMaster address
    /// @param requestId is Tellor Oracle requiest id
    /// @param registrationKey is SuperFluid protocol registration key
    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1 ida,
        ISuperToken inputToken,
        ISuperToken outputToken,
        ISuperToken subsidyToken,
        IUniswapV2Router02 sushiRouter,
        address payable oracle,
        uint256 requestId,
        string memory registrationKey
    ) UsingTellor(oracle) {
        require(address(host) != address(0), "host");
        require(address(cfa) != address(0), "cfa");
        require(address(ida) != address(0), "ida");
        require(address(inputToken) != address(0), "inputToken");
        require(address(outputToken) != address(0), "output");
        require(!host.isApp(ISuperApp(msg.sender)), "owner SA");
        initVars(
            host,
            cfa,
            ida,
            inputToken,
            outputToken,
            subsidyToken,
            sushiRouter,
            oracle,
            requestId,
            registrationKey
        );
    }

    // @dev the "initVars" function is not for a proxy, hence it's not called "initialize"
    function initVars(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1 ida,
        ISuperToken inputToken,
        ISuperToken outputToken,
        ISuperToken subsidyToken,
        IUniswapV2Router02 sushiRouter,
        address payable oracle,
        uint256 requestId,
        string memory registrationKey
    ) private onlyOwner initializer {
        _exchange.sushiRouter = sushiRouter;
        _exchange.host = host;
        _exchange.cfa = cfa;
        _exchange.ida = ida;
        _exchange.inputToken = inputToken;
        _exchange.outputToken = outputToken;
        _exchange.subsidyToken = subsidyToken;
        _exchange.oracle = ITellor(oracle);
        _exchange.requestId = requestId;
        _exchange.feeRate = 20000;
        _exchange.rateTolerance = 10000;
        _exchange.subsidyIndexId = 1;
        _exchange.subsidyRate = 4e17; // 0.4 tokens/second ~ 1,000,000 tokens in a month
        _exchange.owner = msg.sender;

        // Unlimited approve for sushiswap
        ERC20(_exchange.inputToken.getUnderlyingToken()).safeIncreaseAllowance(
            address(_exchange.sushiRouter),
            2**256 - 1
        );
        ERC20(_exchange.outputToken.getUnderlyingToken()).safeIncreaseAllowance(
                address(_exchange.sushiRouter),
                2**256 - 1
            );
        // and Supertoken upgrades
        ERC20(_exchange.inputToken.getUnderlyingToken()).safeIncreaseAllowance(
            address(_exchange.inputToken),
            2**256 - 1
        );
        ERC20(_exchange.outputToken.getUnderlyingToken()).safeIncreaseAllowance(
                address(_exchange.outputToken),
                2**256 - 1
            );

        uint256 configWord = SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        if (bytes(registrationKey).length > 0) {
            _exchange.host.registerAppWithKey(configWord, registrationKey);
        } else {
            _exchange.host.registerApp(configWord);
        }

        // Set up the IDA for sending tokens back
        _exchange._createIndex(_exchange.outputIndexId, _exchange.outputToken);

        // Give the owner 1 share just to start up the contract
        _exchange._updateSubscription(
            _exchange.outputIndexId,
            msg.sender,
            1,
            _exchange.outputToken
        );

        // Setup Liquidity Mining
        _exchange._initalizeLiquidityMining();

        _exchange.lastDistributionAt = block.timestamp;
    }

    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/
    /// @dev If a new stream is opened, or an existing one is opened
    /// @param ctx is SuperFluid context data
    /// @param agreementData is SuperFluid agreement data (non-compressed)
    /// @param doDistributeFirst is distribution needed before outflow update
    /// @return newCtx updated SuperFluid context data
    function _updateOutflow(
        bytes calldata ctx,
        bytes calldata agreementData,
        bool doDistributeFirst
    ) private returns (bytes memory newCtx) {
        newCtx = ctx;

        (, , uint128 totalUnitsApproved, uint128 totalUnitsPending) = _exchange
            .ida
            .getIndex(
                _exchange.outputToken,
                address(this),
                _exchange.outputIndexId
            );
        // Check balance and account for
        uint256 balance = ISuperToken(_exchange.inputToken).balanceOf(
            address(this)
        ) /
            (10 **
                (18 -
                    ERC20(_exchange.inputToken.getUnderlyingToken())
                        .decimals()));

        if (
            doDistributeFirst &&
            totalUnitsApproved + totalUnitsPending > 0 &&
            balance > 0
        ) {
            newCtx = _exchange._distribute(newCtx);
        }

        (address requester, address flowReceiver) = abi.decode(
            agreementData,
            (address, address)
        );
        require(flowReceiver == address(this), "!appflow");
        int96 appFlowRate = _exchange.cfa.getNetFlow(
            _exchange.inputToken,
            address(this)
        );
        (, int96 requesterFlowRate, , ) = _exchange.cfa.getFlow(
            _exchange.inputToken,
            requester,
            address(this)
        );

        // Make sure the requester has at least 8 hours of balance to stream
        require(
            int256(_exchange.inputToken.balanceOf(requester)) >=
                requesterFlowRate * 8 hours,
            "!enoughTokens"
        );

        require(requesterFlowRate >= 0, "!negativeRates");
        newCtx = _exchange._updateSubscriptionWithContext(
            newCtx,
            _exchange.outputIndexId,
            requester,
            uint128(uint256(int256(requesterFlowRate))),
            _exchange.outputToken
        );
        newCtx = _exchange._updateSubscriptionWithContext(
            newCtx,
            _exchange.subsidyIndexId,
            requester,
            uint128(uint256(int256(requesterFlowRate))),
            _exchange.subsidyToken
        );

        emit UpdatedStream(requester, requesterFlowRate, appFlowRate);
    }

    /// @dev Distribute a single `amount` of outputToken among all streamers
    /// @dev Calculates the amount to distribute
    /// @dev Usually called by Keeper
    function distribute() external {
        _exchange._distribute(new bytes(0));
    }

    /// @dev Close stream from `streamer` address if balance is less than 8 hours of streaming
    /// @param streamer is stream source (streamer) address
    function closeStream(address streamer) public {
        _exchange._closeStream(streamer);
    }

    /// @dev Allows anyone to close any stream if the app is jailed.
    /// @param streamer is stream source (streamer) address
    function emergencyCloseStream(address streamer) public {
        _exchange._emergencyCloseStream(streamer);
    }

    /// @dev Drain contract's input and output tokens balance to owner if SuperApp dont have any input streams.
    function emergencyDrain() public {
        _exchange._emergencyDrain();
    }

    /// @dev Set subsidy rate
    /// @param subsidyRate is new rate
    function setSubsidyRate(uint128 subsidyRate) external onlyOwner {
        _exchange.subsidyRate = subsidyRate;
    }

    /// @dev Set fee rate
    /// @param feeRate is new fee rate
    function setFeeRate(uint128 feeRate) external onlyOwner {
        _exchange.feeRate = feeRate;
    }

    /// @dev Set rate tolerance
    /// @param rateTolerance is new rate tolerance
    function setRateTolerance(uint128 rateTolerance) external onlyOwner {
        _exchange.rateTolerance = rateTolerance;
    }

    /// @dev Set Tellor Oracle address
    /// @param oracle new Tellor Oracle address
    function setOracle(address oracle) external onlyOwner {
        _exchange.oracle = ITellor(oracle);
    }

    /// @dev Set Tellor Oracle request ID
    /// @param requestId Tellor Oracle request ID
    function setRequestId(uint256 requestId) external onlyOwner {
        _exchange.requestId = requestId;
    }

    /// @dev Is app jailed in SuperFluid protocol
    /// @return is app jailed in SuperFluid protocol
    function isAppJailed() external view returns (bool) {
        return _exchange.host.isAppJailed(this);
    }

    /// @dev Get `streamer` IDA subscription info for token with index `index`
    /// @param index is token index in IDA
    /// @param streamer is streamer address
    /// @return exist Does the subscription exist?
    /// @return approved Is the subscription approved?
    /// @return units Units of the suscription.
    /// @return pendingDistribution Pending amount of tokens to be distributed for unapproved subscription.
    function getIDAShares(uint32 index, address streamer)
        external
        view
        returns (
            bool exist,
            bool approved,
            uint128 units,
            uint256 pendingDistribution
        )
    {
        ISuperToken idaToken;
        if (index == _exchange.outputIndexId) {
            idaToken = _exchange.outputToken;
        } else if (index == _exchange.subsidyIndexId) {
            idaToken = _exchange.subsidyToken;
        } else {
            return (exist, approved, units, pendingDistribution);
        }

        (exist, approved, units, pendingDistribution) = _exchange
            .ida
            .getSubscription(idaToken, address(this), index, streamer);
    }

    /// @dev Get input token address
    /// @return input token address
    function getInputToken() external view returns (ISuperToken) {
        return _exchange.inputToken;
    }

    /// @dev Get output token address
    /// @return output token address
    function getOuputToken() external view returns (ISuperToken) {
        return _exchange.outputToken;
    }

    /// @dev Get output token IDA index
    /// @return output token IDA index
    function getOuputIndexId() external view returns (uint32) {
        return _exchange.outputIndexId;
    }

    /// @dev Get subsidy token address
    /// @return subsidy token address
    function getSubsidyToken() external view returns (ISuperToken) {
        return _exchange.subsidyToken;
    }

    /// @dev Get subsidy token IDA index
    /// @return subsidy token IDA index
    function getSubsidyIndexId() external view returns (uint32) {
        return _exchange.subsidyIndexId;
    }

    /// @dev Get subsidy rate
    /// @return subsidy rate
    function getSubsidyRate() external view returns (uint256) {
        return _exchange.subsidyRate;
    }

    /// @dev Get total input flow rate
    /// @return input flow rate
    function getTotalInflow() external view returns (int96) {
        return _exchange.cfa.getNetFlow(_exchange.inputToken, address(this));
    }

    /// @dev Get last distribution timestamp
    /// @return last distribution timestamp
    function getLastDistributionAt() external view returns (uint256) {
        return _exchange.lastDistributionAt;
    }

    /// @dev Get SushiSwap router address
    /// @return SushiSwap router address
    function getSushiRouter() external view returns (address) {
        return address(_exchange.sushiRouter);
    }

    /// @dev Get Tellor Oracle address
    /// @return Tellor Oracle address
    function getTellorOracle() external view returns (address) {
        return address(_exchange.oracle);
    }

    /// @dev Get Tellor Oracle request ID
    /// @dev Tellor Oracle request ID
    function getRequestId() external view returns (uint256) {
        return _exchange.requestId;
    }

    /// @dev Get Owner address
    /// @return owner address
    function getOwner() external view returns (address) {
        return _exchange.owner;
    }

    /// @dev Get fee rate
    /// @return fee rate
    function getFeeRate() external view returns (uint128) {
        return _exchange.feeRate;
    }

    /// @dev Get rate tolerance
    /// @return rate tolerance
    function getRateTolerance() external view returns (uint256) {
        return _exchange.rateTolerance;
    }

    /// @dev Get flow rate for `streamer`
    /// @param streamer is streamer address
    /// @return requesterFlowRate `streamer` flow rate
    function getStreamRate(address streamer)
        external
        view
        returns (int96 requesterFlowRate)
    {
        (, requesterFlowRate, , ) = _exchange.cfa.getFlow(
            _exchange.inputToken,
            streamer,
            address(this)
        );
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     * NOTE: Override this to add changing the
     */
    function transferOwnership(address newOwner)
        public
        virtual
        override
        onlyOwner
    {
        super.transferOwnership(newOwner);
        _exchange.owner = newOwner;
    }

    /**************************************************************************
     * SuperApp callbacks
     *************************************************************************/

    /// @dev SuperFluid protocol callback
    /// @dev Callback after a new agreement is created.
    /// @dev Can be called only by SuperFluid protocol host.
    /// @param _superToken The super token used for the agreement.
    /// @param _agreementClass The agreement class address.
    /// @param _agreementData The agreement data (non-compressed)
    /// @param _ctx The context data.
    /// @return newCtx The current context of the transaction.
    function afterAgreementCreated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32, // _agreementId,
        bytes calldata _agreementData,
        bytes calldata, // _cbdata,
        bytes calldata _ctx
    )
        external
        override
        onlyExpected(_superToken, _agreementClass)
        onlyHost
        returns (bytes memory newCtx)
    {
        console.log("afterAgreementCreated");
        if (
            !_exchange._isInputToken(_superToken) ||
            !_exchange._isCFAv1(_agreementClass)
        ) return _ctx;
        return _updateOutflow(_ctx, _agreementData, true);
    }

    /// @dev SuperFluid protocol callback
    /// @dev Callback after a new agreement is updated.
    /// @dev Can be called only by SuperFluid protocol host.
    /// @param _superToken The super token used for the agreement.
    /// @param _agreementClass The agreement class address.
    /// @param _agreementData The agreement data (non-compressed)
    /// @param _ctx The context data.
    /// @return newCtx The current context of the transaction.
    function afterAgreementUpdated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32, //_agreementId,
        bytes calldata _agreementData,
        bytes calldata, //_cbdata,
        bytes calldata _ctx
    )
        external
        override
        onlyExpected(_superToken, _agreementClass)
        onlyHost
        returns (bytes memory newCtx)
    {
        console.log("afterAgreementUpdated");
        console.log(_agreementClass);
        console.log((address(_superToken)));
        if (
            !_exchange._isInputToken(_superToken) ||
            !_exchange._isCFAv1(_agreementClass)
        ) return _ctx;
        console.log("_updateOutflow");
        return _updateOutflow(_ctx, _agreementData, true);
    }

    /// @dev SuperFluid protocol callback
    /// @dev Callback after a new agreement is terminated.
    /// @dev Can be called only by SuperFluid protocol host.
    /// @param _superToken The super token used for the agreement.
    /// @param _agreementClass The agreement class address.
    /// @param _agreementData The agreement data (non-compressed)
    /// @param _ctx The context data.
    /// @return newCtx The current context of the transaction.
    function afterAgreementTerminated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32, //_agreementId,
        bytes calldata _agreementData,
        bytes calldata, //_cbdata,
        bytes calldata _ctx
    ) external override onlyHost returns (bytes memory newCtx) {
        console.log("afterAgreementTerminated");
        // According to the app basic law, we should never revert in a termination callback
        if (
            !_exchange._isInputToken(_superToken) ||
            !_exchange._isCFAv1(_agreementClass)
        ) return _ctx;
        // Skip distribution when terminating to avoid reverts
        return _updateOutflow(_ctx, _agreementData, false);
    }

    /// @dev Restricts calls to only from SuperFluid host
    modifier onlyHost() {
        require(msg.sender == address(_exchange.host), "one host");
        _;
    }

    /// @dev Accept only input token for CFA, output and subsidy tokens for IDA
    modifier onlyExpected(ISuperToken superToken, address agreementClass) {
        if (_exchange._isCFAv1(agreementClass)) {
            require(_exchange._isInputToken(superToken), "!inputAccepted");
        } else if (_exchange._isIDAv1(agreementClass)) {
            require(
                _exchange._isOutputToken(superToken) ||
                    _exchange._isSubsidyToken(superToken),
                "!outputAccepted"
            );
        }
        _;
    }
}
