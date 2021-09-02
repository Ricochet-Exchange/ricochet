RicochetLaunchpad// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "hardhat/console.sol";

import {
    ISuperfluid,
    ISuperToken,
    ISuperToken,
    ISuperAgreement
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./RicochetLaunchpadStorage.sol";


library RicochetLaunchpadHelper {

  using SafeERC20 for ERC20;

  event NewIRO(
    address originator,
    address beneficiary,
    ISuperToken buyToken,
    ISuperToken payToken,
    uint256 rate,
    uint256 duration,
    uint256 idaIndex);

  // Ricochet Launchpad Methods

  function _createIRO(
      RicochetLaunchpadStorage.RicochetLaunchpad storage self,
      address beneficiary,
      ISuperToken buyToken,
      ISuperToken payToken,
      int96 rate,
      uint256 duration) {

    // Validate Arguments
    require(beneficiary != address(0));
    require(address(buyToken) != address(0), "!buyToken");
    require(address(payToken) != address(0), "!payToken");
    require(rate > 0, "!rate");
    require(duration > 0, "!duration");

    // Validate pre-conditions
    require(self.iros[buyToken].beneficiary == address(0), "!new");
    uint256 amount = rate * duration;
    require(amount <= buyToken.balanceOf(msg.sender), "!enough");

    // Fund the IRO
    require(buyToken.transferFrom(msg.sender, address(this), amount), "!funded");

    // Create the new IRO
    self.countIROs += 1;
    RicochetLaunchpadStorage.InitialRicochetOffering iro =
      RicochetLaunchpadStorage.InitialRicochetOffering({
        originator: msg.sender,
        beneficiary: beneficiary,
        buyToken: buyToken,
        payToken: payToken,
        rate: rate,
        duration: duration,
        totalInflow: 0,
        idaIndex: self.countIROs,
        lastDistributionAt: block.timestamp});
    self.iros[buyToken] = iro;

    // Create a IDA pool for this IRO's buyToken
    _exchange._createIndex(iro.idaIndex, iro.buyToken);

    emit NewIRO(iro.originator, iro.beneficiary0, iro.buyToken, iro.payToken, iro.rate, iro.duration, iro.idaIndex);

  }

  function _destroyIRO(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    ISuperToken buyToken) {

    // All streams must be stopped
    require(self.iros[buyToken].totalInflow == 0, "!cleared");
    // Refund the balance of buyTokens to the IRO originator
    require(buyToken.transfer(buyToken.balanceOf(this), self.iros[buyToken].originator), "!refunded");

  }

  function _closeStream(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    ISuperToken buyToken,
    address streamer,
    address closer) {

    // IRO originator can close the streamer's stream,
    // or anyone can close them after there's no more buyToken to distribute
    // TODO: Is msg.sender
    require(closer == self.iros[buyToken].originator ||
      buyToken.balanceOf(address(this) == (block.timestamp - self.iros[buyToken].lastDistributionAt) * self.iros[buyToken].rate ),
      "!allowed");

    // Close the streamers stream
    self.host.callAgreement(
        self.cfa,
        abi.encodeWithSelector(
            self.cfa.deleteFlow.selector,
            self.iros[buyToken].payToken,
            streamer,
            address(this),
            new bytes(0) // placeholder
        ),
        "0x"
    );


  }

  function _distribute(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    ISuperToken buyToken,
    bytes memory ctx)
    external returns (bytes memory newCtx) {

    newCtx = ctx;

    // Calculate amount to distribute
    uint256 distAmount = (block.timestamp - self.iros[buyToken].lastDistributionAt) * self.iros[buyToken].rate;

    // Confirm the app has enough to distribute
    require(buyToken.balanceOf(address(this)) >= distAmount, "!enough");

    newCtx = _idaDistribute(self, buyToken, self.iros[buyToken].idaIndex, uint128(distAmount), newCtx);

    emit Distribution(distAmount, feeCollected, address(self.outputToken));

    self.iros[buyToken].lastDistributionAt = block.timestamp;

    return newCtx;

  }

  // Superfluid Helper Methods

  function _idaDistribute(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    uint32 index,
    ISuperToken distToken,
    uint128 distAmount,
    bytes memory ctx)
    internal returns (bytes memory newCtx) {

    newCtx = ctx;
    if (newCtx.length == 0) { // No context provided
      self.host.callAgreement(
        self.ida,
        abi.encodeWithSelector(
            self.ida.distribute.selector,
            distToken,
            index,
            distAmount,
            new bytes(0) // placeholder ctx
        ),
        new bytes(0) // user data
      );
    } else {
      require(self.host.isCtxValid(newCtx) || newCtx.length == 0, "!distribute");
      (newCtx, ) = self.host.callAgreementWithContext(
        self.ida,
        abi.encodeWithSelector(
            self.ida.distribute.selector,
            distToken,
            index,
            distAmount,
            new bytes(0) // placeholder ctx
        ),
        new bytes(0), // user data
        newCtx
      );
    }
  }

  function _createFlow(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    ISuperToken payToken,
    address to,
    int96 flowRate,
    bytes memory ctx)
    internal returns (bytes memory newCtx) {

    (newCtx, ) = self.host.callAgreementWithContext(
        self.cfa,
        abi.encodeWithSelector(
            self.cfa.createFlow.selector,
            payToken,
            to,
            flowRate,
            new bytes(0) // placeholder
        ),
        "0x",
        ctx
    );
  }

  function _updateFlow(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    ISuperToken payToken,
    address to,
    int96 flowRate,
    bytes memory ctx)
    internal returns (bytes memory newCtx) {

    (newCtx, ) = self.host.callAgreementWithContext(
        self.cfa,
        abi.encodeWithSelector(
            self.cfa.updateFlow.selector,
            payToken,
            to,
            flowRate,
            new bytes(0) // placeholder
        ),
        "0x",
        ctx
    );
  }

  function _deleteFlow(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    ISuperToken payToken,
    address from,
    address to) internal {

    self.host.callAgreement(
        self.cfa,
        abi.encodeWithSelector(
            self.cfa.deleteFlow.selector,
            payToken,
            from,
            to,
            new bytes(0) // placeholder
        ),
        "0x"
    );
  }

  function _createIndex(
    RicochetLaunchpadStorage.RicochetLaunchpad storage self,
    uint256 index,
    ISuperToken distToken) internal {

    self.host.callAgreement(
       self.ida,
       abi.encodeWithSelector(
           self.ida.createIndex.selector,
           distToken,
           index,
           new bytes(0) // placeholder ctx
       ),
       new bytes(0) // user data
     );
  }

  function _updateSubscription(
      RicochetLaunchpadStorage.RicochetLaunchpad storage self,
      uint256 index,
      address subscriber,
      uint128 shares,
      ISuperToken distToken) internal {
    self.host.callAgreement(
       self.ida,
       abi.encodeWithSelector(
           self.ida.updateSubscription.selector,
           distToken,
           index,
           // one share for the to get it started
           subscriber,
           shares / 1e9,
           new bytes(0) // placeholder ctx
       ),
       new bytes(0) // user data
   );
  }

  function _updateSubscriptionWithContext(
      RicochetLaunchpadStorage.RicochetLaunchpad storage self,
      bytes memory ctx,
      uint256 index,
      address subscriber,
      uint128 shares,
      ISuperToken distToken)
      internal returns (bytes memory newCtx)  {

      newCtx = ctx;
      (newCtx, ) = self.host.callAgreementWithContext(
        self.ida,
        abi.encodeWithSelector(
            self.ida.updateSubscription.selector,
            distToken,
            index,
            subscriber,
            shares / 1e9,  // Number of shares is proportional to their rate
            new bytes(0)
        ),
        new bytes(0), // user data
        newCtx
      );
  }

  function _deleteSubscriptionWithContext(
      RicochetLaunchpadStorage.RicochetLaunchpad storage self,
      bytes memory ctx,
      address receiver,
      uint256 index,
      address subscriber,
      ISuperToken distToken)
      internal returns (bytes memory newCtx)  {

      (newCtx, ) = self.host.callAgreementWithContext(
        self.ida,
        abi.encodeWithSelector(
            self.ida.deleteSubscription.selector,
            distToken,
            receiver,
            index,
            subscriber,
            new bytes(0)
        ),
        new bytes(0), // user data
        newCtx
      );
  }

  function _isCFAv1(RicochetLaunchpadStorage.RicochetLaunchpad storage self, address agreementClass) internal view returns (bool) {
      return ISuperAgreement(agreementClass).agreementType()
          == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
  }

  function _isIDAv1(RicochetLaunchpadStorage.RicochetLaunchpad storage self, address agreementClass) internal view returns (bool) {
      return ISuperAgreement(agreementClass).agreementType()
          == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
  }

  }
