// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./StreamExchangeStorage.sol";
import "./SuperfluidHelpers.sol";
import "./StreamExchangeDistribute.sol";


contract StreamExchange is Initializable, OwnableUpgradeable, SuperAppBase {

    // TODO: uint256 public constant RATE_PERCISION = 1000000;
    using SafeERC20 for ERC20;
    using SuperfluidHelpers for StreamExchangeStorage.StreamExchange;
    using StreamExchangeDistribute for StreamExchangeStorage.StreamExchange;
    using StreamExchangeStorage for StreamExchangeStorage.StreamExchange;
    StreamExchangeStorage.StreamExchange internal _exchange;


    constructor(address host, address cfa, address ida) {

      require(address(host) != address(0), "host");
      require(address(cfa) != address(0), "cfa");
      require(address(ida) != address(0), "ida");
      require(!ISuperfluid(host).isApp(ISuperApp(msg.sender)), "owner SA");

      _exchange.host = ISuperfluid(host);
      _exchange.cfa = IConstantFlowAgreementV1(cfa);
      _exchange.ida = IInstantDistributionAgreementV1(ida);

      uint256 configWord =
          SuperAppDefinitions.APP_LEVEL_FINAL |
          SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
          SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
          SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

      _exchange.host.registerApp(configWord);

    }

    function initialize(
        address inputToken,
        address outputToken,
        uint128 feeRate,
        uint32 idaIndexId,
        address sushiRouter,
        address oracle,
        uint256 requestId
    )
        external initializer
    {
        require(address(inputToken) != address(0), "inputToken");
        require(address(outputToken) != address(0), "output");

        _exchange.inputToken = ISuperToken(inputToken);
        _exchange.outputToken = ISuperToken(outputToken);
        _exchange.sushiRouter = IUniswapV2Router02(sushiRouter);
        _exchange.oracle = ITellor(oracle);
        _exchange.requestId = requestId;
        _exchange.feeRate = feeRate; // 0.3%
        _exchange.indexId = idaIndexId;

        // Set up the IDA for sending tokens back
        _exchange._createIndex(_exchange.indexId);

        // Give the owner 1 share just to start up the contract
        _exchange._updateSubscription(_exchange.indexId, msg.sender, 1);

        _exchange.lastDistributionAt = block.timestamp;
    }


    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/

    /// @dev If a new stream is opened, or an existing one is opened
    function _updateOutflow(bytes calldata ctx, bytes calldata agreementData)
        private
        returns (bytes memory newCtx)
    {

      newCtx = ctx;

      // NOTE: Trigger a distribution if there's any inputToken
      console.log("Need to swap this before open new flow",ISuperToken(_exchange.inputToken).balanceOf(address(this)));
      if (ISuperToken(_exchange.inputToken).balanceOf(address(this)) > 0) {
        newCtx = _exchange._distribute(newCtx);
      }
      console.log("Updated context");

      (address requester, address flowReceiver) = abi.decode(agreementData, (address, address));
      int96 changeInFlowRate = _exchange.cfa.getNetFlow(_exchange.inputToken, address(this)) - _exchange.totalInflow;

      _exchange.streams[requester].rate = _exchange.streams[requester].rate + changeInFlowRate;

      console.log("Updating IDA");

      console.log("Current Rate", uint(int(_exchange.streams[requester].rate)));
      console.log("Change in rate", uint(int(changeInFlowRate)));

      if (_exchange.streams[requester].rate == 0) {
        // Delete the subscription
        newCtx = _exchange._deleteSubscriptionWithContext(newCtx, address(this), _exchange.indexId, requester);
      } else {
        // Update the subscription
        // TODO: Move into internal function?
        newCtx = _exchange._updateSubscriptionWithContext(newCtx, _exchange.indexId, requester, uint128(uint(int(_exchange.streams[requester].rate))));
        console.log("Updated share", uint(int(_exchange.streams[requester].rate)));
      }

      _exchange.totalInflow = _exchange.totalInflow + changeInFlowRate;

      // totalInflow / x = (1e6 - feeRate) / 1e6
      // totalInflow * 1e6 = (1e6 - feeRate) * x
      // totalInflow * 1e6 / (1e6 - feeRate) = x

      uint128 ownerShare = _exchange._ownerShare();
      console.log("totalInflow", uint(int(_exchange.totalInflow)));
      console.log("ownerShare", ownerShare);
      // Update the owners share to feeRate
      newCtx = _exchange._updateSubscriptionWithContext(newCtx, _exchange.indexId, owner(), ownerShare);

   }


   function getlastDistributionAt() external view returns (uint256) {
     return _exchange.lastDistributionAt;
   }


   function distribute() external {
     _exchange._distribute(new bytes(0));
   }

   function setOracle(address oracle) external onlyOwner {
     _exchange.oracle = ITellor(oracle);
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
      onlyExpected(_superToken, _agreementClass)
      onlyHost
      returns (bytes memory newCtx)
  {
      if (!_exchange._isInputToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      return _updateOutflow(_ctx, _agreementData);
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
      onlyExpected(_superToken, _agreementClass)
      onlyHost
      returns (bytes memory newCtx)
  {
      if (!_exchange._isInputToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      return _updateOutflow(_ctx, _agreementData);
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
      // According to the app basic law, we should never revert in a termination callback
      if (!_exchange._isInputToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      return _updateOutflow(_ctx, _agreementData);
  }

  modifier onlyHost() {
      require(msg.sender == address(_exchange.host), "one host");
      _;
  }

  modifier onlyExpected(ISuperToken superToken, address agreementClass) {
    if (_exchange._isCFAv1(agreementClass)) {
      require(_exchange._isInputToken(superToken), "!inputAccepted");
    } else if (_exchange._isIDAv1(agreementClass)) {
      require(_exchange._isOutputToken(superToken), "!outputAccepted");
    }
    _;
  }
}
