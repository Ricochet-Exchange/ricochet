// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

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


import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./RicochetLaunchpadStorage.sol";
import "./RicochetLaunchpadHelper.sol";


contract RicochetLaunchpad is Ownable, SuperAppBase {

    using SafeERC20 for ERC20;
    using RicochetLaunchpadHelper for RicochetLaunchpadStorage.RicochetLaunchpad;
    using RicochetLaunchpadStorage for RicochetLaunchpadStorage.RicochetLaunchpad;
    RicochetLaunchpadStorage.RicochetLaunchpad internal launchpad;

    event UpdatedStream(address from, int96 newRate, int96 totalInflow);

    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1 ida,
        uint128 feeRate,
        string memory registrationKey) {
        require(address(host) != address(0), "host");
        require(address(cfa) != address(0), "cfa");
        require(address(ida) != address(0), "ida");
        require(!host.isApp(ISuperApp(msg.sender)), "owner SA");

        launchpad.host = host;
        launchpad.cfa = cfa;
        launchpad.ida = ida;
        launchpad.feeRate = feeRate;
        launchpad.owner = msg.sender;
        launchpad.countIROs = 0;

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

    }

    /**************************************************************************
     * Setters and Getters
     *************************************************************************/


    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/

    /// @dev If a new stream is opened, or an existing one is opened
    function _updateFlow(bytes calldata ctx, bytes calldata agreementData, bool doDistribution)
        private
        returns (bytes memory newCtx)
    {

    newCtx = ctx;

    // Find out which buyToken the update is flow
    (address _buyToken) = abi.decode(newCtx.userData, (address));
    require(launchpad.iros[buyToken].beneficiary != address(0), "!iro");

    (, , uint128 totalUnitsApproved, uint128 totalUnitsPending) = _exchange.ida.getIndex(
                                                                         buyToken,
                                                                         address(this),
                                                                         launchpad.iros[buyToken].idaIndex);

    if (doDistribution && totalUnitsApproved + totalUnitsPending > 0) {
      newCtx = _exchange._distribute(newCtx);
    }

    (address requester, address flowReceiver) = abi.decode(agreementData, (address, address));
    int96 launchpadInflowRate = launchpad.cfa.getNetFlow(launchpad.iros[buyToken].payToken, address(this))
    int96 changeInFlowRate = launchpad.cfa.getNetFlow(launchpad.iros[buyToken].payToken, address(this)) - launchpad.iros[buyToken].totalInflow;

    // Update streamRates
    launchpad.payTokenStreams[payToken] = launchpadInflowRate;
    launchpad.iros[buyToken].streamersRates[requester] += changeInFlowRate
    launchpad.iros[buyToken].totalInflow += changeInFlowRate;

    newCtx = launchpad._updateSubscriptionWithContext(newCtx, buyToken, requester, launchpad.iros[buyToken].streamersRates[requester]);

    int96 beneficiaryOldInflow = launchpad.cfa.getNetFlow(
          launchpad.iros[buyToken].payToken,
          launchpad.iros[buyToken].beneficiary);
    int96 beneficiaryNewInflow = launchpad.iros[buyToken].totalInflow * (1e6 - feeRate) / 1e6

    if (beneficiaryOldInflow == 0) {
      // The beneficiary has no flows, so we open a flow to them
      newCtx = launchpad._createFlow(
        launchpad.iros[buyToken].payToken,
        launchpad.iros[buyToken].beneficiary,
        beneficiaryNewInflow,
        newCtx
      );
    } else if (beneficiaryNewInflow == 0) {
      // There's no more inflow so delete the beneficiary's flow
      launchpad._deleteFlow();
    } else {
      // A flow exists so update the beneficiary's flowwΩ
      newCtx = launchpad.updateFlow(
        launchpad.iros[buyToken].payToken,
        launchpad.iros[buyToken].beneficiary,
        launchpad.iros[buyToken].totalInflow - beneficiaryInflow,
        newCtx
      );

    }

    emit UpdatedStream(requester, launchpad.iros[buyToken].streamersRates[requester]streamersRates, launchpad.iros[buyToken].totalInflow);

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

  function getCFAShares(uint32 payToken, address streamer) external view returns (int96 flowRate) {
    flowRate = _exchange.cfa.getNetFlow(payToken, streamer);
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
