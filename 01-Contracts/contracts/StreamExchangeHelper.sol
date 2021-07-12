// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import {
    ISuperToken,
    ISuperAgreement
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./tellor/UsingTellor.sol";
import "./StreamExchangeStorage.sol";


library StreamExchangeHelper {

  using SafeERC20 for ERC20;

  function _getCurrentValue(
    StreamExchangeStorage.StreamExchange storage self,
    uint256 _requestId
  )
      public
      view
      returns (
          bool ifRetrieve,
          uint256 value,
          uint256 _timestampRetrieved
      )
  {
      uint256 _count = self.oracle.getNewValueCountbyRequestId(_requestId);
      uint256 _time =
          self.oracle.getTimestampbyRequestIDandIndex(_requestId, _count - 1);
      uint256 _value = self.oracle.retrieveData(_requestId, _time);
      if (_value > 0) return (true, _value, _time);
      return (false, 0, _time);
  }


  // @dev Distribute a single `amount` of outputToken among all streamers
  // @dev Calculates the amount to distribute
  function _distribute(
    StreamExchangeStorage.StreamExchange storage self,
    bytes memory ctx
  )
    external returns (bytes memory newCtx)
  {

     newCtx = ctx;
     require(self.host.isCtxValid(newCtx) || newCtx.length == 0, "!distributeCtx");

     uint256 initialBalanceInput = ISuperToken(self.inputToken).balanceOf(address(this));

     // Get the exchange rate as inputToken per outputToken
     bool _didGet;
     uint _timestamp;
     uint _value;

     (_didGet, _value, _timestamp) = _getCurrentValue(self, self.requestId);

     require(_didGet, "!getCurrentValue");
     require(_timestamp >= block.timestamp - 3600, "!currentValue");

     _swap(self, ISuperToken(self.inputToken).balanceOf(address(this)), _value, block.timestamp + 3600);

     uint256 outputBalance = ISuperToken(self.outputToken).balanceOf(address(this));
     (uint256 actualAmount,) = self.ida.calculateDistribution(
        self.outputToken,
        address(this),
        self.outputIndexId,
        outputBalance);

      // Return if there's not anything to actually distribute
      if (actualAmount == 0) { return newCtx; }

      // Calculate the fee for making the distribution
      uint256 feeCollected = outputBalance * self.feeRate / 1e6;
      uint256 distAmount = outputBalance - feeCollected;


      // Calculate subside
      uint256 subsidyAmount = (block.timestamp - self.lastDistributionAt) * self.subsidyRate;

     // Confirm the app has enough to distribute
     require(self.outputToken.balanceOf(address(this)) >= actualAmount, "!enough");

     newCtx = _idaDistribute(self, self.outputIndexId, uint128(actualAmount), self.outputToken, newCtx);

     // Distribute a subsidy if possible
     if(self.subsidyToken.balanceOf(address(this)) >= subsidyAmount) {
       newCtx = _idaDistribute(self, self.subsidyIndexId, uint128(subsidyAmount), self.subsidyToken, newCtx);
     }

     self.lastDistributionAt = block.timestamp;

     // Take the fee
     ISuperToken(self.outputToken).transfer(self.owner, feeCollected);

     return newCtx;

   }

   function _swap(
         StreamExchangeStorage.StreamExchange storage self,
         uint256 amount,
         uint256 exchangeRate,
         uint256 deadline
     ) public returns(uint) {

     uint256 minOutput = amount  * 1e18 / exchangeRate / 1e12;

     self.inputToken.downgrade(amount);
     address inputToken = self.inputToken.getUnderlyingToken();
     address outputToken = self.outputToken.getUnderlyingToken();
     address[] memory path = new address[](2);
     path[0] = inputToken;
     path[1] = outputToken;

     // approve the router to spend
     ERC20(inputToken).safeIncreaseAllowance(address(self.sushiRouter), amount);

     uint[] memory amounts = self.sushiRouter.swapExactTokensForTokens(
         amount,
         minOutput,
         path,
         address(this),
         deadline
     );

     ERC20(outputToken).safeIncreaseAllowance(address(self.outputToken), amounts[1]);
     self.outputToken.upgrade(amounts[1]);

     // TODO: Take a small fee

     return amounts[1];
     }


  function _initalizeLiquidityMining(StreamExchangeStorage.StreamExchange storage self) internal {
    // Create the index for IDA
    _createIndex(self, self.subsidyIndexId, self.subsidyToken);
    // Give the initalizer 1 share to get it started
    _updateSubscription(self, self.subsidyIndexId, msg.sender, 1, self.subsidyToken);
  }

  function _idaDistribute(StreamExchangeStorage.StreamExchange storage self, uint32 index, uint128 distAmount, ISuperToken distToken, bytes memory ctx) internal returns (bytes memory newCtx) {
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

  function _createIndex(StreamExchangeStorage.StreamExchange storage self, uint256 index, ISuperToken distToken) internal {
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
      StreamExchangeStorage.StreamExchange storage self,
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
           shares,
           new bytes(0) // placeholder ctx
       ),
       new bytes(0) // user data
   );
  }

  function _updateSubscriptionWithContext(
      StreamExchangeStorage.StreamExchange storage self,
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
            shares,  // Number of shares is proportional to their rate
            new bytes(0)
        ),
        new bytes(0), // user data
        newCtx
      );
  }

  function _deleteSubscriptionWithContext(
      StreamExchangeStorage.StreamExchange storage self,
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






  /**************************************************************************
   * SuperApp callbacks
   *************************************************************************/

  function _isInputToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.inputToken);
  }

  function _isOutputToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.outputToken);
  }

  function _isSubsidyToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.subsidyToken);
  }

  function _isCFAv1(StreamExchangeStorage.StreamExchange storage self, address agreementClass) internal view returns (bool) {
      return ISuperAgreement(agreementClass).agreementType()
          == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
  }

  function _isIDAv1(StreamExchangeStorage.StreamExchange storage self, address agreementClass) internal view returns (bool) {
      return ISuperAgreement(agreementClass).agreementType()
          == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
  }

  }
