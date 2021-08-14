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

    // TODO: uint256 public constant RATE_PERCISION = 1000000;
    using SafeERC20 for ERC20;
    using StreamExchangeHelper for StreamExchangeStorage.StreamExchange;
    using StreamExchangeStorage for StreamExchangeStorage.StreamExchange;
    StreamExchangeStorage.StreamExchange internal _exchange;

    event UpdatedStream(address from, int96 newRate, int96 totalInflow);

    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1  ida,
        ISuperToken inputToken,
        ISuperToken outputToken,
        ISuperToken subsidyToken,
        IUniswapV2Router02 sushiRouter,
        address payable oracle,
        uint256 requestId,
        string memory registrationKey)
        UsingTellor(oracle) {
        require(address(host) != address(0), "host");
        require(address(cfa) != address(0), "cfa");
        require(address(ida) != address(0), "ida");
        require(address(inputToken) != address(0), "inputToken");
        require(address(outputToken) != address(0), "output");
        require(!host.isApp(ISuperApp(msg.sender)), "owner SA");

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

        // Set up the IDA for sending tokens back
        _exchange._createIndex(_exchange.outputIndexId, _exchange.outputToken);

        // Give the owner 1 share just to start up the contract
        _exchange._updateSubscription(_exchange.outputIndexId, msg.sender, 1, _exchange.outputToken);

        // Setup Liquidity Mining
        _exchange._initalizeLiquidityMining();

        _exchange.lastDistributionAt = block.timestamp;
    }

    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/

    /// @dev If a new stream is opened, or an existing one is opened
  function _updateOutflow(bytes calldata ctx, bytes calldata agreementData, bool doDistributeFirst)
      private
      returns (bytes memory newCtx)
  {

    newCtx = ctx;

    (, , uint128 totalUnitsApproved, uint128 totalUnitsPending) = _exchange.ida.getIndex(
                                                                         _exchange.outputToken,
                                                                         address(this),
                                                                         _exchange.outputIndexId);

    if (doDistributeFirst && totalUnitsApproved + totalUnitsPending > 0 && ISuperToken(_exchange.inputToken).balanceOf(address(this)) > 0) {
      newCtx = _exchange._distribute(newCtx);
    }

    (address requester, address flowReceiver) = abi.decode(agreementData, (address, address));
    int96 changeInFlowRate = _exchange.cfa.getNetFlow(_exchange.inputToken, address(this)) - _exchange.totalInflow;

    _exchange.streams[requester].rate = _exchange.streams[requester].rate + changeInFlowRate;

    // Make sure the requester has at least 8 hours of balance to stream
    require(int(_exchange.inputToken.balanceOf(requester)) >= _exchange.streams[requester].rate * 8 hours, "!enoughTokens");

    newCtx = _exchange._updateSubscriptionWithContext(newCtx, _exchange.outputIndexId, requester, uint128(uint(int(_exchange.streams[requester].rate))), _exchange.outputToken);
    newCtx = _exchange._updateSubscriptionWithContext(newCtx, _exchange.subsidyIndexId, requester, uint128(uint(int(_exchange.streams[requester].rate))), _exchange.subsidyToken);

    _exchange.totalInflow = _exchange.totalInflow + changeInFlowRate;

    emit UpdatedStream(requester, _exchange.streams[requester].rate, _exchange.totalInflow);

  }


  function distribute() external {
   _exchange._distribute(new bytes(0));
  }

  function closeStream(address streamer) public {
    _exchange._closeStream(streamer);
  }

  function emergencyCloseStream(address streamer) public {
    _exchange._emergencyCloseStream(streamer);
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

  function getIDAShares(uint32 index, address streamer) external view returns (bool exist,
                bool approved,
                uint128 units,
                uint256 pendingDistribution) {

    ISuperToken idaToken;
    if(index == _exchange.outputIndexId) {

      idaToken = _exchange.outputToken;

    } else if (index == _exchange.subsidyIndexId) {

      idaToken = _exchange.subsidyToken;

    } else {
      return (exist, approved, units, pendingDistribution);
    }

    (exist, approved, units, pendingDistribution) = _exchange.ida.getSubscription(
                                                                  idaToken,
                                                                  address(this),
                                                                  index,
                                                                  streamer);
  }

  function getInputToken() external view returns (ISuperToken) {
   return _exchange.inputToken;
  }

  function getOuputToken() external view returns (ISuperToken) {
   return _exchange.outputToken;
  }

  function getOuputIndexId() external view returns (uint32) {
   return _exchange.outputIndexId;
  }

  function getSubsidyToken() external view returns (ISuperToken) {
   return _exchange.subsidyToken;
  }

  function getSubsidyIndexId() external view returns (uint32) {
   return _exchange.subsidyIndexId;
  }

  function getSubsidyRate() external view returns (uint256) {
    return _exchange.subsidyRate;
  }

  function getTotalInflow() external view returns (int96) {
    return _exchange.totalInflow;
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

  function getStreamRate(address streamer) external view returns (int96) {
    return _exchange.streams[streamer].rate;
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
      onlyExpected(_superToken, _agreementClass)
      onlyHost
      returns (bytes memory newCtx)
  {
      if (!_exchange._isInputToken(_superToken) || !_exchange._isCFAv1(_agreementClass)) return _ctx;
      return _updateOutflow(_ctx, _agreementData, true);
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
      return _updateOutflow(_ctx, _agreementData, true);
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
      // Skip distribution when terminating to avoid reverts
      return _updateOutflow(_ctx, _agreementData, false);
  }



  modifier onlyHost() {
      require(msg.sender == address(_exchange.host), "one host");
      _;
  }

  modifier onlyExpected(ISuperToken superToken, address agreementClass) {
    if (_exchange._isCFAv1(agreementClass)) {
      require(_exchange._isInputToken(superToken), "!inputAccepted");
    } else if (_exchange._isIDAv1(agreementClass)) {
      require(_exchange._isOutputToken(superToken) || _exchange._isSubsidyToken(superToken), "!outputAccepted");
    }
    _;
  }


  }
