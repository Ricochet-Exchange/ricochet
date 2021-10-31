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

/// @title Stream Exchange SuperApp helper library
library StreamExchangeHelper {

  using SafeERC20 for ERC20;

  // TODO: Emit these events where appropriate
  /// @dev Distribution event. Emitted on each token distribution operation.
  /// @param totalAmount is total distributed amount
  /// @param feeCollected is fee amount collected during distribution
  /// @param token is distributed token address
  event Distribution(uint256 totalAmount, uint256 feeCollected, address token);

  /// @dev Stream update event. Emitted on each stream update.
  /// @param from is stream origin address
  /// @param newRate is new stream rate
  /// @param totalInflow is total incoming input token flow rate
  event UpdatedStream(address from, int96 newRate, int96 totalInflow);

  /// @dev Close stream from `streamer` address if balance is less than 8 hours of streaming
  /// @param streamer is stream source (streamer) address
  function _closeStream(StreamExchangeStorage.StreamExchange storage self, address streamer) public {
    // Only closable iff their balance is less than 8 hours of streaming
    (,int96 streamerFlowRate,,) = self.cfa.getFlow(self.inputToken, streamer, address(this));
    require(int(self.inputToken.balanceOf(streamer)) <= streamerFlowRate * 8 hours,
              "!closable");

    // Update Subscriptions
    _updateSubscription(self, self.subsidyIndexId, streamer, 0, self.subsidyToken);
    _updateSubscription(self, self.outputIndexId, streamer, 0, self.outputToken);
    emit UpdatedStream(streamer, 0, self.cfa.getNetFlow(self.inputToken, address(this)));

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

    emit UpdatedStream(streamer, 0, self.cfa.getNetFlow(self.inputToken, address(this)));

  }


  /// @dev Allows anyone to close any stream if the app is jailed.
  /// @param streamer is stream source (streamer) address
  function _emergencyCloseStream(StreamExchangeStorage.StreamExchange storage self, address streamer) public {
    // Allows anyone to close any stream if the app is jailed
    bool isJailed = self.host.isAppJailed(ISuperApp(address(this)));
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

  /// @dev Drain contract's input and output tokens balance to owner if SuperApp dont have any input streams.
  function _emergencyDrain(StreamExchangeStorage.StreamExchange storage self) public {
    require(self.cfa.getNetFlow(self.inputToken, address(this)) == 0, "!zeroStreamers");
    self.inputToken.transfer(self.owner, self.inputToken.balanceOf(address(this)));
    self.outputToken.transfer(self.owner, self.outputToken.balanceOf(address(this)));
  }


  /// @dev Get currect value from Tellor Oracle
  /// @param _requestId is request ID in Tellor Oracle
  /// @return ifRetrieve is bool value that indicates that oracle returned value greater than 0.
  /// @return value last value for request ID
  /// @return _timestampRetrieved last value's timestamp
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


  /// @dev Distribute a single `amount` amount of output token among all streamers
  /// @dev Calculates the amount to distribute
  /// @param ctx SuperFluid context data
  /// @return newCtx updated SuperFluid context data
  function _distribute(
    StreamExchangeStorage.StreamExchange storage self,
    bytes memory ctx
  )
    external returns (bytes memory newCtx)
  {

     newCtx = ctx;
     require(self.host.isCtxValid(newCtx) || newCtx.length == 0, "!distributeCtx");

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

     console.log("outputBalance", outputBalance);
     console.log("actualAmount", actualAmount);

      // Return if there's not anything to actually distribute
      if (actualAmount == 0) { return newCtx; }

      // Calculate the fee for making the distribution
      uint256 feeCollected = actualAmount * self.feeRate / 1e6;
      uint256 distAmount = actualAmount - feeCollected;

      // Calculate subside
      uint256 subsidyAmount = (block.timestamp - self.lastDistributionAt) * self.subsidyRate;

     // Confirm the app has enough to distribute
     require(self.outputToken.balanceOf(address(this)) >= actualAmount, "!enough");
     newCtx = _idaDistribute(self, self.outputIndexId, uint128(distAmount), self.outputToken, newCtx);
     emit Distribution(distAmount, feeCollected, address(self.outputToken));

     // Distribute a subsidy if possible
     if(self.subsidyToken.balanceOf(address(this)) >= subsidyAmount) {
       newCtx = _idaDistribute(self, self.subsidyIndexId, uint128(subsidyAmount), self.subsidyToken, newCtx);
       emit Distribution(subsidyAmount, 0, address(self.subsidyToken));
     }

     self.lastDistributionAt = block.timestamp;

     // Take the fee
     ISuperToken(self.outputToken).transfer(self.owner, feeCollected);
     // NOTE: After swapping any token with < 18 decimals, there may be dust left so just leave it
     require(self.inputToken.balanceOf(address(this)) /
             10 ** (18 - ERC20(self.inputToken.getUnderlyingToken()).decimals()) == 0,
             "!sellAllInput");


     return newCtx;

   }

   function _swap(
         StreamExchangeStorage.StreamExchange storage self,
         uint256 amount,  // Assumes this is outputToken.balanceOf(address(this))
         uint256 exchangeRate,
         uint256 deadline
     ) public returns(uint) {

    address inputToken;           // The underlying input token address
    address outputToken;          // The underlying output token address
    address[] memory path;        // The path to take
    uint256 minOutput;            // The minimum amount of output tokens based on Tellor
    uint256 outputAmount; // The balance before the swap

    inputToken = self.inputToken.getUnderlyingToken();
    outputToken = self.outputToken.getUnderlyingToken();

    // Downgrade and scale the input amount
    console.log("Amount", amount);
    self.inputToken.downgrade(amount);
    // Scale it to 1e18 for calculations
    amount = ERC20(inputToken).balanceOf(address(this)) * (10 ** (18 - ERC20(inputToken).decimals()));

    // TODO: This needs to be "invertable"
    // USD >> TOK
    // minOutput = amount * 1e18 / exchangeRate / 1e12;
    // TOK >> USD
    minOutput = amount  * exchangeRate / 1e6;
    minOutput = minOutput * (1e6 - self.rateTolerance) / 1e6;

    // Scale back from 1e18 to outputToken decimals
    minOutput = minOutput * (10 ** (ERC20(outputToken).decimals())) / 1e18;
    // Scale it back to inputToken decimals
    amount = amount / (10 ** (18 - ERC20(inputToken).decimals()));

    path = new address[](2);
    path[0] = inputToken;
    path[1] = outputToken;
    self.sushiRouter.swapExactTokensForTokens(
       amount,
       0, // Accept any amount but fail if we're too far from the oracle price
       path,
       address(this),
       deadline
    );
    // Assumes `amount` was outputToken.balanceOf(address(this))
    outputAmount = ERC20(outputToken).balanceOf(address(this));
    require(outputAmount >= minOutput, "BAD_EXCHANGE_RATE: Try again later");

    // Convert the outputToken back to its supertoken version
    self.outputToken.upgrade(outputAmount * (10 ** (18 - ERC20(outputToken).decimals())));

    return outputAmount;
  }

  /// @dev Creates SuperFluid IDA index for subsidy token and creates share for sender
  function _initalizeLiquidityMining(StreamExchangeStorage.StreamExchange storage self) internal {
    // Create the index for IDA
    _createIndex(self, self.subsidyIndexId, self.subsidyToken);
    // Give the initalizer 1 share to get it started
    _updateSubscription(self, self.subsidyIndexId, msg.sender, 1, self.subsidyToken);
  }

  /// @dev Distributes `distAmount` amount of `distToken` token among all IDA index subscribers
  /// @param index IDA index ID
  /// @param distAmount amount to distribute
  /// @param distToken distribute token address
  /// @param ctx SuperFluid context data
  /// @return newCtx updated SuperFluid context data
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

  /// @dev Create new IDA index for `distToken`
  /// @param index IDA index ID
  /// @param distToken token address
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

  /// @dev Set new `shares` share for `subscriber` address in IDA with `index` index
  /// @param index IDA index ID
  /// @param subscriber is subscriber address
  /// @param shares is distribution shares count
  /// @param distToken is distribution token address
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

  /// @dev Same as _updateSubscription but uses provided SuperFluid context data
  /// @param ctx SuperFluid context data
  /// @param index IDA index ID
  /// @param subscriber is subscriber address
  /// @param shares is distribution shares count
  /// @param distToken is distribution token address
  /// @return newCtx updated SuperFluid context data
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

  /// @dev Cancel subscription for `receiver` to `index` IDA index
  /// @param ctx SuperFluid context data
  /// @param receiver index publisher address
  /// @param index IDA index ID
  /// @param subscriber subscriber address
  /// @param distToken is distribution token address
  /// @return newCtx updated SuperFluid context data
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
  /// @dev Is `superToken` address an input token?
  /// @param superToken token address
  /// @return bool - is `superToken` address an input token
  function _isInputToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.inputToken);
  }

  /// @dev Is `superToken` address an output token?
  /// @param superToken token address
  /// @return bool - is `superToken` address an output token
  function _isOutputToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.outputToken);
  }

  /// @dev Is `superToken` address an subsidy token?
  /// @param superToken token address
  /// @return bool - is `superToken` address an subsidy token
  function _isSubsidyToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.subsidyToken);
  }

  /// @dev Is provided agreement address an CFA?
  /// @param agreementClass agreement address
  /// @return bool - is provided address an CFA
  function _isCFAv1(StreamExchangeStorage.StreamExchange storage self, address agreementClass) internal view returns (bool) {
      return ISuperAgreement(agreementClass).agreementType()
          == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
  }

  /// @dev Is provided agreement address an IDA?
  /// @param agreementClass agreement address
  /// @return bool - is provided address an IDA
  function _isIDAv1(StreamExchangeStorage.StreamExchange storage self, address agreementClass) internal view returns (bool) {
      return ISuperAgreement(agreementClass).agreementType()
          == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
  }

  }
