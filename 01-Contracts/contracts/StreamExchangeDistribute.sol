// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./StreamExchangeStorage.sol";

library StreamExchangeDistribute {

    using SafeERC20 for ERC20;

    function _ownerShare(StreamExchangeStorage.StreamExchange storage self)
      external returns (uint128)
    {
      return uint128((uint(int(self.totalInflow)) * 1e6 / ( 1e6 - self.feeRate)) - uint(int(self.totalInflow)));
    }

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


       // Compute the amount to distribute
       // TODO: Don't declare so many variables
       uint256 time_delta = block.timestamp - self.lastDistributionAt;

       // Get the exchange rate as inputToken per outputToken
       bool _didGet;
       uint _timestamp;
       uint _value;

       (_didGet, _value, _timestamp) = _getCurrentValue(self, self.requestId);

       require(_didGet, "!getCurrentValue");
       require(_timestamp >= block.timestamp - 3600, "!currentValue");

       uint256 amount = _swap(self, ISuperToken(self.inputToken).balanceOf(address(this)), _value, block.timestamp + 3600);

       (uint256 actualAmount,) = self.ida.calculateDistribution(
        self.outputToken,
        address(this), self.indexId,
        amount);

       // Confirm the app has enough to distribute
       require(self.outputToken.balanceOf(address(this)) >= actualAmount, "!enough");

       if (newCtx.length == 0) { // No context provided
         self.host.callAgreement(
            self.ida,
            abi.encodeWithSelector(
                self.ida.distribute.selector,
                self.outputToken,
                self.indexId,
                actualAmount,
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
                self.outputToken,
                self.indexId,
                actualAmount,
                new bytes(0) // placeholder ctx
            ),
            new bytes(0), // user data
            newCtx
         );
       }

       console.log("Distribution amount", actualAmount);
       console.log("Amount", amount);

       self.lastDistributionAt = block.timestamp;

       return newCtx;

     }

     function _swap(
           StreamExchangeStorage.StreamExchange storage self,
           uint256 amount,
           uint256 exchangeRate,
           uint256 deadline
       ) public returns(uint) {


       uint256 minOutput = amount  * 1e6 / exchangeRate;

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


  }
