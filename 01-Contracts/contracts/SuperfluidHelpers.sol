// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import {
    ISuperToken,
    ISuperAgreement
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import "./tellor/UsingTellor.sol";
import "./StreamExchangeStorage.sol";


library SuperfluidHelpers {


    function _createIndex(StreamExchangeStorage.StreamExchange storage self, uint256 index) internal {
      self.host.callAgreement(
         self.ida,
         abi.encodeWithSelector(
             self.ida.createIndex.selector,
             self.outputToken,
             index,
             new bytes(0) // placeholder ctx
         ),
         new bytes(0) // user data
       );
    }

    function _updateSubscription(StreamExchangeStorage.StreamExchange storage self, uint256 index, address subscriber, uint128 shares) internal {
      self.host.callAgreement(
         self.ida,
         abi.encodeWithSelector(
             self.ida.updateSubscription.selector,
             self.outputToken,
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
        uint128 shares)
        internal returns (bytes memory newCtx)  {

        newCtx = ctx;
        (newCtx, ) = self.host.callAgreementWithContext(
          self.ida,
          abi.encodeWithSelector(
              self.ida.updateSubscription.selector,
              self.outputToken,
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
        address subscriber)
        internal returns (bytes memory newCtx)  {

        (newCtx, ) = self.host.callAgreementWithContext(
          self.ida,
          abi.encodeWithSelector(
              self.ida.deleteSubscription.selector,
              self.outputToken,
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

    function _isCFAv1(StreamExchangeStorage.StreamExchange storage self, address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    }

    function _isIDAv1(StreamExchangeStorage.StreamExchange storage self, address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
    }


  }
