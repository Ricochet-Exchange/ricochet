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
import "./IRicochetToken.sol";
import "./matic/IWMATIC.sol";
import "./superfluid/IMATICx.sol";


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

     console.log("Swap and Deposit");
     _harvestSwapAndDeposit(self, self.inputToken.balanceOf(address(this)), _value, block.timestamp + 3600);
     console.log("Done Swap and Deposit");

     uint256 outputBalance = self.outputToken.balanceOf(address(this));
     console.log("slpx balance", outputBalance);
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

     // Distribute a subsidy if possible
     if(self.subsidyToken.balanceOf(address(this)) >= subsidyAmount) {
       newCtx = _idaDistribute(self, self.subsidyIndexId, uint128(subsidyAmount), self.subsidyToken, newCtx);
       emit Distribution(subsidyAmount, 0, address(self.subsidyToken));
     }

     // Distribute MiniChef rewards iff there are rewards to distribute
     subsidyAmount = self.sushixToken.balanceOf(address(this));
     if (subsidyAmount > 0) {
       // TODO: Take fee
       newCtx = _idaDistribute(self, self.sushixIndexId, uint128(subsidyAmount), self.sushixToken, newCtx);
       emit Distribution(subsidyAmount, 0, address(self.sushixToken));
     }

     subsidyAmount = uint128(self.maticxToken.balanceOf(address(this)));
     if (self.maticxToken.balanceOf(address(this)) > 0) {
       // TODO: Take fee
       newCtx = _idaDistribute(self, self.maticxIndexId, uint128(subsidyAmount), self.maticxToken, newCtx);
       emit Distribution(subsidyAmount, 0, address(self.maticxToken));
     }

     self.lastDistributionAt = block.timestamp;

     // Take the fee
     self.outputToken.transfer(self.owner, feeCollected);
     // NOTE: After swapping any token with < 18 decimals, there may be dust left so just leave it
     require(self.inputToken.balanceOf(address(this)) /
             10 ** (18 - ERC20(self.inputToken.getUnderlyingToken()).decimals()) == 0,
             "!sellAllInput");

     console.log("Done distribute");
     return newCtx;

   }

   // Credit: Pickle.finance
   function _harvestSwapAndDeposit(
         StreamExchangeStorage.StreamExchange storage self,
         uint256 amount,  // Assumes this is outputToken.balanceOf(address(this))
         uint256 exchangeRate,
         uint256 deadline
     ) public returns(uint) {

       // Harvest anything in Minichef
       console.log("Check for pending rewards");
       if (self.miniChef.pendingSushi(self.pid, address(this)) > 0) {
         _harvest(self);
       }


       ERC20 inputToken = ERC20(self.inputToken.getUnderlyingToken());
       ERC20 pairToken = ERC20(self.pairToken.getUnderlyingToken());

       // Downgrade all the input supertokens
       console.log("Downgrade tokens");
       self.inputToken.downgrade(self.inputToken.balanceOf(address(this)));

        // Swap half of input tokens to pair tokens
        uint256 _inTokenBalance = inputToken.balanceOf(address(this));
        console.log("in token balance", _inTokenBalance);
        if (_inTokenBalance > 0) {
            _swapSushiswap(self.sushiRouter, address(inputToken), address(pairToken), _inTokenBalance / 2);
        }

        // Adds liquidity for inputToken/pairToken
        _inTokenBalance = inputToken.balanceOf(address(this));
        uint256 _pairTokenBalance = pairToken.balanceOf(address(this));
        if (_inTokenBalance > 0 && _pairTokenBalance > 0) {
            pairToken.safeApprove(address(self.sushiRouter), 0);
            pairToken.safeApprove(address(self.sushiRouter), _pairTokenBalance);
            console.log("addLiquidity");
            (uint amountA, uint amountB, uint liquidity) = self.sushiRouter.addLiquidity(
                address(inputToken),
                address(pairToken),
                _inTokenBalance,
                _pairTokenBalance,
                0,
                0,
                address(this),
                block.timestamp + 60
            );
            console.log("added liquidity", liquidity);
            console.log("SLP test", self.slpToken.balanceOf(0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA));
            console.log("SLP", address(self.slpToken));
            uint256 slpBalance = self.slpToken.balanceOf(address(this));
            console.log("This many SLP tokens", slpBalance);
            // Deposit the SLP tokens recieved into MiniChef
            self.slpToken.approve(address(self.miniChef), slpBalance);

            self.miniChef.deposit(self.pid, slpBalance, address(this));
            console.log("Deposited to minichef");
            // Mint an equal amount of SLPx
            IRicochetToken(address(self.outputToken)).mintTo(address(this), slpBalance, new bytes(0));
            console.log("upgraded");
        }


        // Now the contract has SLPx tokens to distribute

    }

    // Credit: Pickle.finance
    function _swapSushiswap(
        IUniswapV2Router02 sushiRouter,
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        require(_to != address(0));

        address[] memory path;

        // TODO: This is direct pairs, probably not the best
        // if (_from == weth || _to == weth) {
            path = new address[](2);
            path[0] = _from;
            path[1] = _to;
        // } else {
        //     path = new address[](3);
        //     path[0] = _from;
        //     path[1] = weth;
        //     path[2] = _to;
        // }

        sushiRouter.swapExactTokensForTokens(
            _amount,
            0,
            path,
            address(this),
            block.timestamp + 60
        );
    }

    function _harvest(StreamExchangeStorage.StreamExchange storage self) internal {
      // Get SUSHI and MATIC reward
      // Try to harvest from minichef, catch and continue iff there's no sushi
      try self.miniChef.withdrawAndHarvest(self.pid, 0, address(this)) {
      } catch Error(string memory reason) {
        require(keccak256(bytes(reason)) == keccak256(bytes("BoringERC20: Transfer failed")), "!boringERC20Error");
        return;
      }

      // Upgrade SUSHI and MATIC if any
      uint256 sushis = IERC20(self.sushixToken.getUnderlyingToken()).balanceOf(address(this));
      uint256 matics = IERC20(self.maticxToken.getUnderlyingToken()).balanceOf(address(this));

      // Calculate the fee for MATIC
      uint256 feeCollected = matics * self.harvestFeeRate / 1e6;
      matics = matics - feeCollected;

      // Upgrade and take a fee
      IWMATIC(self.maticxToken.getUnderlyingToken()).withdraw(matics);
      if (matics > 0) {
        IMATICx(address(self.maticxToken)).upgradeByETH{value: matics}();
        self.maticxToken.transfer(self.owner, feeCollected);
      }

      // Calculate the fee
      feeCollected = sushis * self.harvestFeeRate / 1e6;
      sushis = sushis - feeCollected;
      if (sushis > 0) {
        self.sushixToken.upgrade(sushis);
        self.sushixToken.transfer(self.owner, feeCollected);
      }




    }

    function _executeApprovals(StreamExchangeStorage.StreamExchange storage self) internal {
      // Unlimited approve for sushiswap
      ERC20(self.inputToken.getUnderlyingToken()).safeIncreaseAllowance(address(self.sushiRouter), 2**256 - 1);
      ERC20(self.pairToken.getUnderlyingToken()).safeIncreaseAllowance(address(self.sushiRouter), 2**256 - 1);

      // Approve minichef
      ERC20(self.slpToken).safeIncreaseAllowance(address(self.miniChef), 2**256 - 1);

      // and Supertoken upgrades
      ERC20(self.outputToken.getUnderlyingToken()).safeIncreaseAllowance(address(self.outputToken), 2**256 - 1);
      ERC20(self.sushixToken.getUnderlyingToken()).safeIncreaseAllowance(address(self.sushixToken), 2**256 - 1);
      ERC20(self.maticxToken.getUnderlyingToken()).safeIncreaseAllowance(address(self.maticxToken), 2**256 - 1);
    }

    // Sets up IDAs for distributing output, subsidy, and rewards tokens
    function initialize(
      StreamExchangeStorage.StreamExchange storage self,
      ISuperToken output,
      ISuperToken subsidy,
      ISuperToken sushix,
      ISuperToken maticx) public {

      // Set up the IDA for sending tokens back
      self.outputIndexId = 0;
      self.subsidyIndexId = 1;
      self.sushixIndexId = 2;
      self.maticxIndexId = 3;
      self.outputToken = output;
      self.subsidyToken = subsidy;
      self.sushixToken = sushix;
      self.maticxToken = maticx;

      _createIndex(self, self.outputIndexId, self.outputToken);
      _createIndex(self, self.subsidyIndexId, self.subsidyToken);
      _createIndex(self, self.sushixIndexId, self.sushixToken);
      _createIndex(self, self.maticxIndexId, self.maticxToken);

      // Give the owner 1 share just to start up the contract
      _updateSubscription(self, self.outputIndexId, msg.sender, 1, self.outputToken);
      _updateSubscription(self, self.subsidyIndexId, msg.sender, 1, self.subsidyToken);
      _updateSubscription(self, self.sushixIndexId, msg.sender, 1, self.sushixToken);
      _updateSubscription(self, self.maticxIndexId, msg.sender, 1, self.maticxToken);

      _executeApprovals(self);

      self.lastDistributionAt = block.timestamp;
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
  function _createIndex(
    StreamExchangeStorage.StreamExchange storage self,
    uint256 index,
    ISuperToken distToken
  ) internal {

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

  /// @dev Is `superToken` address an rewards token?
  /// @param superToken token address
  /// @return bool - is `superToken` address an subsidy token
  function _isRewardsToken(StreamExchangeStorage.StreamExchange storage self, ISuperToken superToken) internal view returns (bool) {
      return address(superToken) == address(self.sushixToken) || address(superToken) == address(self.maticxToken);
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
