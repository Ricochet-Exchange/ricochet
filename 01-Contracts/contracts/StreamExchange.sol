// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

// import "hardhat/console.sol";

import {
    ISuperfluid,
    ISuperToken,
    ISuperApp,
    ISuperAgreement,
    SuperAppDefinitions
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";//"@superfluid-finance/ethereum-monorepo/packages/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {
    IInstantDistributionAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";

import {
    SuperAppBase
} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./tellor/UsingTellor.sol";

import "./StreamExchangeStorage.sol";
import "./StreamExchangeHelper.sol";
import "./tellor/ITellor.sol";


contract StreamExchange is Ownable, SuperAppBase, UsingTellor {

    using SafeERC20 for ERC20;
    using StreamExchangeHelper for StreamExchangeStorage.StreamExchange;
    using StreamExchangeStorage for StreamExchangeStorage.StreamExchange;
    StreamExchangeStorage.StreamExchange internal _exchange;

    // TODO: This event needs to include which token the streams updated for
    event UpdatedStream(address from, address token, int96 newRate, int96 totalInflow);

    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1  ida,
        ISuperToken tokenA,
        ISuperToken tokenB,
        ISuperToken subsidyToken,
        IUniswapV2Router02 sushiRouter,
        address payable oracle,
        uint256 requestId,
        string memory registrationKey)
        UsingTellor(oracle) {
        require(address(host) != address(0), "host");
        require(address(cfa) != address(0), "cfa");
        require(address(ida) != address(0), "ida");
        require(address(tokenA) != address(0), "tokenA");
        require(address(tokenB) != address(0), "tokenB");
        require(!host.isApp(ISuperApp(msg.sender)), "owner SA");

        _exchange.sushiRouter = sushiRouter;
        _exchange.host = host;
        _exchange.cfa = cfa;
        _exchange.ida = ida;
        _exchange.poolA.token = tokenA;
        _exchange.poolB.token = tokenB;
        _exchange.subsidyToken = subsidyToken;
        _exchange.poolA.idaIndex = 0;
        _exchange.poolB.idaIndex = 1;
        _exchange.subsidyIdaIndex = 2;
        _exchange.oracle = ITellor(oracle);
        _exchange.requestId = requestId;
        _exchange.feeRate = 20000;
        _exchange.rateTolerance = 10000;
        _exchange.subsidyRate = 4e17; // 0.4 tokens/second ~ 1,000,000 tokens in a month
        _exchange.owner = msg.sender;

        // Unlimited approve for sushiswap
        ERC20(_exchange.poolA.token.getUnderlyingToken()).safeIncreaseAllowance(address(_exchange.sushiRouter), 2**256 - 1);
        ERC20(_exchange.poolB.token.getUnderlyingToken()).safeIncreaseAllowance(address(_exchange.sushiRouter), 2**256 - 1);
        // and Supertoken upgrades
        ERC20(_exchange.poolA.token.getUnderlyingToken()).safeIncreaseAllowance(address(_exchange.poolA.token), 2**256 - 1);
        ERC20(_exchange.poolB.token.getUnderlyingToken()).safeIncreaseAllowance(address(_exchange.poolB.token), 2**256 - 1);


        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        if(bytes(registrationKey).length > 0) {
            _exchange.host.registerAppWithKey(configWord, registrationKey);
        } else {
            _exchange.host.registerApp(configWord);
        }

        // Setup tokenA and tokenB IDA Indexes
        _exchange._createIndex(_exchange.poolA.idaIndex, _exchange.poolA.token);
        _exchange._createIndex(_exchange.poolB.idaIndex, _exchange.poolB.token);

        // Setup Liquidity Mining
        _exchange._initalizeLiquidityMining();

        _exchange.lastDistributionAt = block.timestamp;
    }

    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/

    /// @dev If a new stream is opened, or an existing one is opened
  function _updateOutflow(bytes calldata ctx, bytes calldata agreementData, ISuperToken inputToken, bool doDistributeFirst)
      private
      returns (bytes memory newCtx)
  {

    // TODO: Needs to know which of the tokens this stream is for, either tokenA or tokenB
    // NOTE: Generally this looks OK, just every instance of input/ouput token needs
    //       to be replaced and a check to see which token we have is needed

    newCtx = ctx;
    (address requester, address flowReceiver) = abi.decode(agreementData, (address, address));

    StreamExchangeStorage.TokenPool storage pool;
    if(inputToken == _exchange.poolA.token) {
      pool = _exchange.poolA;
    } else {
      pool = _exchange.poolB;
    }

    (, , uint128 totalUnitsApproved, uint128 totalUnitsPending) = _exchange.ida.getIndex(
                                                                         // TODO: tokenA/B
                                                                         pool.token,
                                                                         address(this),
                                                                         pool.idaIndex);

    if (doDistributeFirst && totalUnitsApproved + totalUnitsPending > 0 && pool.token.balanceOf(address(this)) > 0) {
      newCtx = _exchange._distribute(newCtx);
    }

    int96 changeInFlowRate = _exchange.cfa.getNetFlow(pool.token, address(this)) - pool.totalInflow;
    pool.streams[requester].rate = pool.streams[requester].rate + changeInFlowRate;

    newCtx = _exchange._updateSubscriptionWithContext(newCtx, pool.idaIndex, requester, uint128(uint(int(pool.streams[requester].rate))), pool.token);

    //TODO: Subsidy token will need to contain two pools
    newCtx = _exchange._updateSubscriptionWithContext(newCtx, _exchange.subsidyIdaIndex, requester, uint128(uint(int(pool.streams[requester].rate))), _exchange.subsidyToken);

    pool.totalInflow = pool.totalInflow + changeInFlowRate;

    emit UpdatedStream(requester, address(pool.token), pool.streams[requester].rate, pool.totalInflow);

  }


  function distribute() external {
   _exchange._distribute(new bytes(0));
  }

  function setSubsidyRate(uint128 subsidyRate) external onlyOwner {
    _exchange.subsidyRate = subsidyRate;
  }

  function setFeeRate(uint128 feeRate) external onlyOwner {
    _exchange.feeRate = feeRate;
  }

  function setRateTolerance(uint128 rateTolerance) external onlyOwner {
    _exchange.rateTolerance = rateTolerance;
  }

  function setOracle(address oracle) external onlyOwner {
    _exchange.oracle = ITellor(oracle);
  }

  function setRequestId(uint256 requestId) external onlyOwner {
    _exchange.requestId = requestId;
  }

  function isAppJailed() external view returns (bool) {
   return _exchange.host.isAppJailed(this);
  }

  function getInputToken(uint256 pool) external view returns (ISuperToken) {
    if(pool == 0) {
      return _exchange.poolA.token;
    } else {
      return _exchange.poolA.token;
    }
  }

  function getTotalInflow(uint256 pool) external view returns (int96) {
    if(pool == 0) {
      return _exchange.poolA.totalInflow;
    } else {
      return _exchange.poolA.totalInflow;
    }
  }

  // TODO: More getters for the TokenPools properties

  function getSubsidyToken() external view returns (ISuperToken) {
   return _exchange.subsidyToken;
  }

  function getSubsidyIdaIndex() external view returns (uint32) {
   return _exchange.subsidyIdaIndex;
  }

  function getSubsidyRate() external view returns (uint256) {
    return _exchange.subsidyRate;
  }

  function getLastDistributionAt() external view returns (uint256) {
    return _exchange.lastDistributionAt;
  }

  function getSushiRouter() external view returns (address) {
    return address(_exchange.sushiRouter);
  }

  function getTellorOracle() external view returns (address) {
    return address(_exchange.oracle);
  }

  function getRequestId() external view returns (uint256) {
    return _exchange.requestId;
  }

  function getOwner() external view returns (address) {
    return _exchange.owner;
  }

  function getFeeRate() external view returns (uint128) {
    return _exchange.feeRate;
  }

  function getRateTolerance() external view returns (uint256) {
    return _exchange.rateTolerance;
  }

  function getStreamRate(address streamer, uint256 pool) external view returns (int96) {
    if(pool == 0) {
      return _exchange.poolA.streams[streamer].rate;
    } else {
      return _exchange.poolA.streams[streamer].rate;
    }
  }

  function emergencyCloseStream(address streamer, address token) public {
    // Allows anyone to close any stream iff the app is jailed
    bool isJailed = ISuperfluid(msg.sender).isAppJailed(ISuperApp(address(this)));
    require(isJailed, "!jailed");
    _exchange.host.callAgreement(
        _exchange.cfa,
        abi.encodeWithSelector(
            _exchange.cfa.deleteFlow.selector,
            token,
            streamer,
            address(this),
            new bytes(0) // placeholder
        ),
        "0x"
    );
  }

  /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     * NOTE: Override this to add changing the
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        super.transferOwnership(newOwner);
        _exchange.owner = newOwner;
    }

  /**************************************************************************
   * SuperApp callbacks
   *************************************************************************/

  function afterAgreementCreated(
      ISuperToken _superToken,
      address _agreementClass,
      bytes32, // _agreementId,
      bytes calldata _agreementData,
      bytes calldata ,// _cbdata,
      bytes calldata _ctx
  )
      external override
      onlyHost
      returns (bytes memory newCtx)
  {
      // TODO: Checks to handle both tokenA and tokenB, this is where it can detected which Supertoken we have
      if (!_exchange._isAllowedToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      return _updateOutflow(_ctx, _agreementData, _superToken, true);
  }

  function afterAgreementUpdated(
      ISuperToken _superToken,
      address _agreementClass,
      bytes32 ,//_agreementId,
      bytes calldata _agreementData,
      bytes calldata ,//_cbdata,
      bytes calldata _ctx
  )
      external override
      onlyHost
      returns (bytes memory newCtx)
  {
      // TODO: Checks to handle both tokenA and tokenB, this is where it can detected which Supertoken we have
      if (!_exchange._isAllowedToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      return _updateOutflow(_ctx, _agreementData, _superToken, true);
  }

  function afterAgreementTerminated(
      ISuperToken _superToken,
      address _agreementClass,
      bytes32 ,//_agreementId,
      bytes calldata _agreementData,
      bytes calldata ,//_cbdata,
      bytes calldata _ctx
  )
      external override
      onlyHost
      returns (bytes memory newCtx)
  {
      // TODO: Checks to handle both tokenA and tokenB, this is where it can detected which Supertoken we have
      // According to the app basic law, we should never revert in a termination callback
      if (!_exchange._isAllowedToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      // Skip distribution when terminating to avoid reverts
      return _updateOutflow(_ctx, _agreementData, _superToken, false);
  }



  modifier onlyHost() {
      require(msg.sender == address(_exchange.host), "one host");
      _;
  }


}
