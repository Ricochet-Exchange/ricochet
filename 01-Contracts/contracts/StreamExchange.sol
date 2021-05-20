// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

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
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


import "./StreamExchangeStorage.sol";
import "./ISimpleOracle.sol";

contract StreamExchange is SuperAppBase, Ownable {

    uint32 public constant INDEX_ID = 0;
    // TODO: uint256 public constant RATE_PERCISION = 1000000;
    using SafeERC20 for ERC20;
    using StreamExchangeStorage for StreamExchangeStorage.StreamExchange;
    StreamExchangeStorage.StreamExchange internal _exchange;

    // TODO: Emit these events where appropriate
    event NewInboundStream(address to, address token, uint96 rate);
    event NewOutboundStream(address to, address token, uint96 rate);
    event Distribution(address token, uint256 totalAmount);  // TODO: Implement triggered distribution


    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1  ida,
        ISuperToken inputToken,
        ISuperToken outputToken,
        IUniswapV2Router02 sushiRouter,
        ISimpleOracle simpleOracle) {
        require(address(host) != address(0), "host");
        require(address(cfa) != address(0), "cfa");
        require(address(ida) != address(0), "ida");
        require(address(inputToken) != address(0), "inputToken");
        require(address(outputToken) != address(0), "output");
        require(!host.isApp(ISuperApp(msg.sender)), "owner SA");

        _exchange.sushiRouter = sushiRouter;
        _exchange.simpleOracle = simpleOracle;
        _exchange.host = host;
        _exchange.cfa = cfa;
        _exchange.ida = ida;
        _exchange.inputToken = inputToken;
        _exchange.outputToken = outputToken;

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        _exchange.host.registerApp(configWord);

        // Set up the IDA for sending tokens back
        _exchange.host.callAgreement(
           _exchange.ida,
           abi.encodeWithSelector(
               _exchange.ida.createIndex.selector,
               _exchange.outputToken,
               INDEX_ID,
               new bytes(0) // placeholder ctx
           ),
           new bytes(0) // user data
         );
        _exchange.lastDistributionAt = block.timestamp;
    }


    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/

    /// @dev If a new stream is opened, or an existing one is opened
    function _updateOutflow(bytes calldata ctx)
        private
        returns (bytes memory newCtx)
    {

      // TODO: Perform a distribution here and reset lastDistributionAt

      // TODO: I believe there is a better way to do this?
      newCtx = ctx;

      // Check for rate change
      address requester = _exchange.host.decodeCtx(ctx).msgSender;
      int96 inflowRate = _exchange.cfa.getNetFlow(_exchange.inputToken, address(this));
      if (_exchange.streams[requester].rate == inflowRate) {
        // Rate has not changed, return
        return newCtx;
      } else {
        // Add/update the streamer
        _exchange.streams[requester].rate = _exchange.streams[requester].rate + inflowRate;
      }

      (,int96 ownerOutflowRate,,) = _exchange.cfa.getFlow(_exchange.inputToken, address(this), owner()); //CHECK: unclear what happens if flow doesn't exist.


      // Next split this into 80/20
      // TODO: Safemath needs to be here for sure
      int96 ownerInFlowRate;
      if (inflowRate == 0) {
        ownerInFlowRate = 0;
      } else {
        // NOTE: Here a fee can be taked
        ownerInFlowRate = ownerOutflowRate + inflowRate;
      }

      // TODO: Verify this if-else chain works
      if (ownerOutflowRate == int96(0)) {
        newCtx = _createFlow(owner(), ownerInFlowRate, newCtx);
      } else if (ownerInFlowRate == int96(0)) {
        newCtx = _deleteFlow(address(this), owner(), newCtx);
      } else {
        newCtx = _updateFlow(owner(), ownerInFlowRate, newCtx);
      }

      console.log("update subscription");

      // TODO: Update the IDA pool to add this user
      // The inflow rate is the number of shares to issue
      (newCtx, ) = _exchange.host.callAgreementWithContext(
        _exchange.ida,
        abi.encodeWithSelector(
            _exchange.ida.updateSubscription.selector,
            _exchange.outputToken,
            INDEX_ID,
            requester,
            uint128(_exchange.streams[requester].rate),  // Number of shares is proportional to their rate
            new bytes(0)
        ),
        new bytes(0), // user data
        newCtx
      );

      _exchange.totalInflow = _exchange.totalInflow + inflowRate; // TODO: Safemath

      // TODO: Need to put the new streamers into a "timeout" to prevent someone
      //       from streaming for a few seconds

   }

   function setExchangeRate(uint256 rate) external onlyOwner {
     // TODO: Use an oracle
     _exchange.rate = rate;
   }

   function getlastDistributionAt() external view returns (uint256) {
     return _exchange.lastDistributionAt;
   }

   // @dev Distribute a single `amount` of outputToken among all streamers
   // @dev Calculates the amount to distribute
   function distribute() external onlyOwner {

      // TODO: Swap USDCx to ETH to aWETH to aWETHx

      // Compute the amount to distribute
      // TODO: Don't declare so many variables
      uint256 time_delta = block.timestamp - _exchange.lastDistributionAt;
      uint256 inflowAmount = uint256(_exchange.totalInflow) * time_delta;
      uint256 amount = inflowAmount / _exchange.rate; // TODO: RATE_PERCISION;

      (uint256 actualAmount,) = _exchange.ida.calculateDistribution(
       _exchange.outputToken,
       address(this), INDEX_ID,
       amount);

      // Confirm the app has enough to distribute
      require(_exchange.outputToken.balanceOf(address(this)) >= actualAmount, "no outputToken");
      // _exchange.outputToken.transferFrom(owner(), address(this), actualAmount);

      _exchange.host.callAgreement(
         _exchange.ida,
         abi.encodeWithSelector(
             _exchange.ida.distribute.selector,
             _exchange.outputToken,
             INDEX_ID,
             actualAmount,
             new bytes(0) // placeholder ctx
         ),
         new bytes(0) // user data
      );

      _exchange.lastDistributionAt = block.timestamp;

    }

    /**************************************************************************
     * SuperApp callbacks
     *************************************************************************/

    function afterAgreementCreated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32, // _agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,// _cbdata,
        bytes calldata _ctx
    )
        external override
        onlyExpected(_superToken, _agreementClass)
        onlyHost
        returns (bytes memory newCtx)
    {
        return _updateOutflow(_ctx);
    }

    function afterAgreementUpdated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32 ,//_agreementId,
        bytes calldata , //agreementData,
        bytes calldata ,//_cbdata,
        bytes calldata _ctx
    )
        external override
        onlyExpected(_superToken, _agreementClass)
        onlyHost
        returns (bytes memory newCtx)
    {
        return _updateOutflow(_ctx);
    }

    function afterAgreementTerminated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32 ,//_agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,//_cbdata,
        bytes calldata _ctx
    )
        external override
        onlyHost
        returns (bytes memory newCtx)
    {
        // According to the app basic law, we should never revert in a termination callback
        if (!_isSameToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx);
    }

    function _isSameToken(ISuperToken superToken) internal view returns (bool) {
        return address(superToken) == address(_exchange.inputToken);
    }

    function _isCFAv1(address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    }

    modifier onlyHost() {
        require(msg.sender == address(_exchange.host), "one host");
        _;
    }

    modifier onlyExpected(ISuperToken superToken, address agreementClass) {
        require(_isSameToken(superToken), "not accepted");
        require(_isCFAv1(agreementClass), "v1 supported");
        _;
    }

    function _createFlow(address to, int96 flowRate) internal {
       _exchange.host.callAgreement(
           _exchange.cfa,
           abi.encodeWithSelector(
               _exchange.cfa.createFlow.selector,
               _exchange.inputToken,
               to,
               flowRate,
               new bytes(0) // placeholder
           ),
           "0x"
       );
    }

    function _createFlow(
        address to,
        int96 flowRate,
        bytes memory ctx
    ) internal returns (bytes memory newCtx) {
        (newCtx, ) = _exchange.host.callAgreementWithContext(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.createFlow.selector,
                _exchange.inputToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );
    }

    function _updateFlow(address to, int96 flowRate) internal {
        _exchange.host.callAgreement(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.updateFlow.selector,
                _exchange.inputToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    function _updateFlow(
        address to,
        int96 flowRate,
        bytes memory ctx
    ) internal returns (bytes memory newCtx) {
        (newCtx, ) = _exchange.host.callAgreementWithContext(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.updateFlow.selector,
                _exchange.inputToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );
    }

    function _deleteFlow(address from, address to) internal {
        _exchange.host.callAgreement(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.deleteFlow.selector,
                _exchange.inputToken,
                from,
                to,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    function _deleteFlow(
        address from,
        address to,
        bytes memory ctx
    ) internal returns (bytes memory newCtx) {
        (newCtx, ) = _exchange.host.callAgreementWithContext(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.deleteFlow.selector,
                _exchange.inputToken,
                from,
                to,
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );
    }


  function swap(
        uint256 amount,
        uint256 minOutput,
        uint256 deadline
    ) internal returns(uint) {

        _exchange.inputToken.downgrade(amount);

        address inputToken = _exchange.inputToken.getUnderlyingToken();
        address outputToken = _exchange.outputToken.getUnderlyingToken();

        address[] memory path = new address[](2);
        path[0] = address(inputToken);
        path[1] = outputToken;

        // approve the router to spend
        ERC20(inputToken).safeIncreaseAllowance(address(_exchange.sushiRouter), amount);

        uint[] memory amounts = _exchange.sushiRouter.swapExactTokensForTokens(
            amount,
            minOutput,
            path,
            address(this),
            deadline
        );

        return amounts[1];
    }
  }
