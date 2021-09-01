// SPDX-License-Identifier: MIT
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

import "./tellor/UsingTellor.sol";
import "./StreamExchangeStorage.sol";


library StreamExchangeHelper {

  using SafeERC20 for ERC20;

  event Distribution(uint256 totalAmount, uint256 feeCollected, address token);
  event InternalSwap(uint256 inAmount, address inToken, uint256 outAmount, address outToken);

  function _closeStream(StreamExchangeStorage.StreamExchange storage self, address streamer) public {
    // Only closable iff their balance is less than 8 hours of streaming
    require(int(self.inputToken.balanceOf(streamer)) <= self.streams[streamer].rate * 8 hours,
              "!closable");

    self.streams[streamer].rate = 0;

    // Update Subscriptions
    _updateSubscription(self, self.subsidyIndexId, streamer, 0, self.subsidyToken);
    _updateSubscription(self, self.outputIndexId, streamer, 0, self.outputToken);

    // Close the streamers stream
    self.host.callAgreement(
        self.cfa,
        abi.encodeWithSelector(
            self.cfa.deleteFlow.selector,
            self.inputToken,
            streamer,
            address(this),
            new bytes(0) // placeholder
        ),
        "0x"
    );

  }

  function _emergencyCloseStream(StreamExchangeStorage.StreamExchange storage self, address streamer) public {
    // Allows anyone to close any stream iff the app is jailed
    bool isJailed = ISuperfluid(msg.sender).isAppJailed(ISuperApp(address(this)));
    require(isJailed, "!jailed");
    self.host.callAgreement(
        self.cfa,
        abi.encodeWithSelector(
            self.cfa.deleteFlow.selector,
            self.inputToken,
            streamer,
            address(this),
            new bytes(0) // placeholder
        ),
        "0x"
    );
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

     // Get the exchange rate as inputToken per outputToken
     (bool _didGet, uint exchangeRate, uint _timestamp) = _getCurrentValue(self, self.requestId);

     require(_didGet, "!getCurrentValue");
     require(_timestamp >= block.timestamp - 3600, "!currentValue");

     // Figure out the surplus and make the swap needed to fulfill this distribution
     console.log("TokenA Balance", self.poolA.token.balanceOf(address(this)));
     console.log("TokenB Balance", self.poolB.token.balanceOf(address(this)));

     // Check how much tokenA we want to fill the sale of tokenB
     uint256 tokenWant = self.poolB.token.balanceOf(address(this)) * exchangeRate / 1e6;
     address[] memory path = new address[](2);
     // If we have more tokenA than we need, swap the surplus
     if (tokenWant < self.poolA.token.balanceOf(address(this))) {
       console.log("Surplus to swap tokenA", self.poolA.token.balanceOf(address(this)) - tokenWant);
       path[0] = address(self.poolA.token);
       path[1] = address(self.poolB.token);
       _swap(self, self.poolA.token.balanceOf(address(this)) - tokenWant, path, block.timestamp + 3600);
     // Otherwise we have more tokenB than we need, swap the surplus (if any)
     } else {
       tokenWant = self.poolA.token.balanceOf(address(this)) * 1e18 / exchangeRate / 1e12;
       console.log("Surplus to swap tokenB", self.poolB.token.balanceOf(address(this)) - tokenWant);
       path[0] = address(self.poolB.token);
       path[1] = address(self.poolA.token);
       _swap(self, self.poolB.token.balanceOf(address(this)) - tokenWant, path, block.timestamp + 3600);
     }

     // At this point, we've got enough of tokenA and tokenB to perform the distribution
     uint256 tokenAAmount = self.poolA.token.balanceOf(address(this));
     uint256 tokenBAmount = self.poolB.token.balanceOf(address(this));

     (tokenAAmount,) = self.ida.calculateDistribution(
        self.poolA.token,
        address(this),
        self.poolA.idaIndex, //TODO: Add to storage
        tokenAAmount);
     (tokenBAmount,) = self.ida.calculateDistribution(
        self.poolB.token,
        address(this),
        self.poolB.idaIndex, //TODO: Add to storage
        tokenBAmount);

      // Perform the distribution
      uint256 feeCollected;
      uint256 distAmount;
      if (tokenAAmount > 0) {
        // Distribute TokenA
        (feeCollected, distAmount) = _getFeeAndDist(tokenAAmount, self.feeRate);
        console.log("Distributing tokenA distAmount", distAmount);
        console.log("Distributing tokenA feeCollected", feeCollected);
        require(self.poolA.token.balanceOf(address(this)) >= tokenAAmount, "!enough");
        newCtx = _idaDistribute(self, self.poolA.idaIndex, uint128(distAmount), self.poolA.token, newCtx);
        self.poolA.token.transfer(self.owner, feeCollected);
        emit Distribution(distAmount, feeCollected, address(self.poolA.token));
      }
      if (tokenBAmount > 0) {
        // Distribute TokenB
        (feeCollected, distAmount) = _getFeeAndDist(tokenBAmount, self.feeRate);
        console.log("Distributing tokenB distAmount", distAmount);
        console.log("Distributing tokenB feeCollected", feeCollected);
        require(self.poolB.token.balanceOf(address(this)) >= tokenBAmount, "!enough");
        newCtx = _idaDistribute(self, self.poolB.idaIndex, uint128(distAmount), self.poolB.token, newCtx);
        self.poolB.token.transfer(self.owner, feeCollected);
        emit Distribution(distAmount, feeCollected, address(self.poolB.token));
      }

     // TODO: Bring back subsidy
     // // Distribute a subsidy if possible
     // if(self.subsidyToken.balanceOf(address(this)) >= subsidyAmount) {
     //   newCtx = _idaDistribute(self, self.subsidyIdaIndex, uint128(subsidyAmount), self.subsidyToken, newCtx);
     //   emit Distribution(subsidyAmount, 0, address(self.subsidyToken));
     // }

     self.lastDistributionAt = block.timestamp;
     return newCtx;

   }

   function _swap(
         StreamExchangeStorage.StreamExchange storage self,
         uint256 amount,  // Assumes this is outputToken.balanceOf(address(this))
         address[] memory path,
         uint256 deadline
     ) public returns(uint) {

    uint256 minOutput;       // The minimum amount of output tokens based on Tellor
    uint256 outputAmount;    // The balance before the swap

    console.log("Amount to swap", amount);

    ISuperToken(path[0]).downgrade(amount);
    // Scale it to 1e18 for calculations
    amount = ERC20(inputToken).balanceOf(address(this)) * (10 ** (18 - ERC20(inputToken).decimals()));

    // Compute Exchange Rate
    // TODO: This needs to be "invertable"
    // USD >> TOK
    minOutput = amount * 1e18 / exchangeRate / 1e12;
    console.log("minOutput", minOutput);
    // TOK >> USD
    // minOutput = amount  * exchangeRate / 1e6;
    minOutput = minOutput * (1e6 - self.rateTolerance) / 1e6;
    console.log("minOutput", minOutput);
    // Scale back from 1e18 to outputToken decimals
    minOutput = minOutput * (10 ** (ERC20(outputToken).decimals())) / 1e18;
    // Scale it back to inputToken decimals
    amount = amount / (10 ** (18 - ERC20(inputToken).decimals()));


    address inputToken = ISuperToken(path[0]).getUnderlyingToken();
    address outputToken = ISuperToken(path[1]).getUnderlyingToken();
    path[0] = inputToken;
    path[1] = outputToken;

    // Swap on Sushiswap and verify swap rate is good using oracle price
    uint256 initialBalance = ERC20(path[1]).balanceOf(address(this));
    self.sushiRouter.swapExactTokensForTokens(
       amount,
       0, // Accept any amount but fail if we're too far from the oracle price
       path,
       address(this),
       deadline
    );
    // Assumes `amount` was outputToken.balanceOf(address(this))
    outputAmount = ERC20(path[1]).balanceOf(address(this)) - initialBalance;
    console.log("outputAmount", outputAmount);
    require(outputAmount >= minOutput, "BAD_EXCHANGE_RATE: Try again later");
    // Convert the outputToken back to its supertoken version
    // Unlimited approval in the constructor
    ISuperToken(path[1]).upgrade(outputAmount);
    emit InternalSwap(amount, path[0], outputAmount, path[1]);
    return outputAmount;
  }

  function _getFeeAndDist(uint256 tokenAmount, uint256 feeRate)
    public returns (uint256 feeCollected, uint256 distAmount) {

      feeCollected = tokenAmount * feeRate / 1e6;
      distAmount = tokenAmount - feeCollected;
  }

  function _initalizeLiquidityMining(StreamExchangeStorage.StreamExchange storage self) internal {
    // Create the index for IDA
    _createIndex(self, self.subsidyIdaIndex, self.subsidyToken);
    // Give the initalizer 1 share to get it started
    _updateSubscription(self, self.subsidyIdaIndex, msg.sender, 1, self.subsidyToken);
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
           shares / 1e9,
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
            shares / 1e9,  // Number of shares is proportional to their rate
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

   function _isAllowedToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
       return _isTokenA(self, superToken) || _isTokenB(self, superToken);
   }

  function _isTokenA(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.poolA.token);
  }

  function _isTokenB(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.poolB.token);
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
