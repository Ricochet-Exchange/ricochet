// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
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

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./tellor/UsingTellor.sol";

import "./StreamExchangeStorage.sol";

/// @title A contract which provides DCA purchase of ETH using supefluidfinance
/// @author 
/// @notice 
/// @dev 
contract StreamExchange is Ownable, SuperAppBase, UsingTellor {

    uint32 public constant INDEX_ID = 0;
    // TODO: uint256 public constant RATE_PERCISION = 1000000;
    using SafeERC20 for ERC20;
    using StreamExchangeStorage for StreamExchangeStorage.StreamExchange;
    StreamExchangeStorage.StreamExchange internal _exchange;

    // TODO: Emit these events where appropriate
    event NewInboundStream(address to, address token, uint96 rate);
    event NewOutboundStream(address to, address token, uint96 rate);
    event Distribution(address token, uint256 totalAmount);  // TODO: Implement triggered distribution


    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IInstantDistributionAgreementV1  ida,
        ISuperToken inputToken,
        ISuperToken outputToken,
        IUniswapV2Router02 sushiRouter,
        address payable oracle,
        uint256 requestId)
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
        _exchange.oracle = oracle;
        _exchange.requestId = requestId;

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        _exchange.host.registerApp(configWord);

        // Set up the IDA for sending tokens back
        _exchange.host.callAgreement(
           _exchange.ida,
           abi.encodeWithSelector(
               _exchange.ida.createIndex.selector,
               _exchange.outputToken,
               INDEX_ID,
               new bytes(0) // placeholder ctx
           ),
           new bytes(0) // user data
         );
        _exchange.lastDistributionAt = block.timestamp;
    }


    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/
    
    /// @notice 
    /// @dev If a new stream is opened, or an existing one is opened
    /// @param ctx
    /// @param agreementData
    /// @return newCtx 
    function _updateOutflow(bytes calldata ctx, bytes calldata agreementData)
        private
        returns (bytes memory newCtx)
    {

      newCtx = ctx;

      (address requester, address flowReceiver) = abi.decode(agreementData, (address, address));
      int96 changeInFlowRate = _exchange.cfa.getNetFlow(_exchange.inputToken, address(this)) - _exchange.totalInflow;

      if (_exchange.streams[requester].rate == changeInFlowRate) { // Rate has not changed, return
        return newCtx;
      } else { // Add/update the streamer
        _exchange.streams[requester].rate = _exchange.streams[requester].rate + changeInFlowRate;
      }

      console.log("Updating IDA");

      if (_exchange.streams[requester].rate == 0) {
        // Delete the subscription
        // TODO: Move into internal function?
        (newCtx, ) = _exchange.host.callAgreementWithContext(
          _exchange.ida,
          abi.encodeWithSelector(
              _exchange.ida.deleteSubscription.selector,
              _exchange.outputToken,
              address(this),
              INDEX_ID,
              requester,
              new bytes(0)
          ),
          new bytes(0), // user data
          newCtx
        );

      } else {
        // Update the subscription
        // TODO: Move into internal function?
        (newCtx, ) = _exchange.host.callAgreementWithContext(
          _exchange.ida,
          abi.encodeWithSelector(
              _exchange.ida.updateSubscription.selector,
              _exchange.outputToken,
              INDEX_ID,
              requester,
              uint128(_exchange.streams[requester].rate),  // Number of shares is proportional to their rate
              new bytes(0)
          ),
          new bytes(0), // user data
          newCtx
        );
      }

      console.log("Done updating IDA");
      _exchange.totalInflow = _exchange.totalInflow + changeInFlowRate;

      // TODO: Need to put the new streamers into a "timeout" to prevent someone
      //       from streaming for a few seconds

      // NOTE: Trigger a distribution if there's any inputToken
      console.log("Need to swap this before open new flow",ISuperToken(_exchange.inputToken).balanceOf(address(this)));
      if (ISuperToken(_exchange.inputToken).balanceOf(address(this)) > 0) {
        newCtx = distribute(newCtx);
      }

   }

   /// @notice Returns the time when the last distribution was made
   /// @dev 
   /// @return A Unix time stamp
   function getlastDistributionAt() external view returns (uint256) {
     return _exchange.lastDistributionAt;
   }

   /// @notice  
   /// @dev 
   /// @param 
   /// @return
   function distributeWithContext() internal {

   }

   /// @notice Function used to distribute a single amount of token to all the streamers
   /// @param ctx 
   /// @return newCtx 
   /// @dev Distribute a single `amount` of outputToken among all streamers
   /// @dev Calculates the amount to distribute
   function distribute(bytes memory ctx) public returns (bytes memory newCtx){

      newCtx = ctx;

      // Compute the amount to distribute
      // TODO: Don't declare so many variables
      uint256 time_delta = block.timestamp - _exchange.lastDistributionAt;

      // NOTE: Swaps all inputToken held, which may not be the best idea?
      uint256 amount = swap(ISuperToken(_exchange.inputToken).balanceOf(address(this)), block.timestamp + 3600);

      // NOTE: Why does this truncate decimal values?
      (uint256 actualAmount,) = _exchange.ida.calculateDistribution(
       _exchange.outputToken,
       address(this), INDEX_ID,
       amount);

      // Confirm the app has enough to distribute
      require(_exchange.outputToken.balanceOf(address(this)) >= actualAmount, "!enough");

      // TODO: Make the fee a parameter
      uint256 distAmount = actualAmount * 997000 / 1000000;
      uint256 feeCollected = actualAmount * 3000 / 1000000;

      console.log("Distributing", distAmount);

      if (newCtx.length == 0) { // No context provided
        _exchange.host.callAgreement(
           _exchange.ida,
           abi.encodeWithSelector(
               _exchange.ida.distribute.selector,
               _exchange.outputToken,
               INDEX_ID,
               actualAmount,
               new bytes(0) // placeholder ctx
           ),
           new bytes(0) // user data
        );
      } else {
      (newCtx, ) = _exchange.host.callAgreementWithContext(
           _exchange.ida,
           abi.encodeWithSelector(
               _exchange.ida.distribute.selector,
               _exchange.outputToken,
               INDEX_ID,
               actualAmount,
               new bytes(0) // placeholder ctx
           ),
           new bytes(0), // user data
           newCtx
        );
      }

      // Take a fee and send to the owner
      ISuperToken(_exchange.outputToken).transfer(owner(), feeCollected); // 30 basis points
      _exchange.lastDistributionAt = block.timestamp;

      return newCtx;

    }

    /// @notice Swap the passed amount of inputToken to to get outputToken
    /// @dev 
    /// @param amount Amount of input token you are looking to swap
    /// @param deadline Time you are willing to wait for transaction to finish
    /// @return Amount of swapped token received
    function swap(
          uint256 amount,
          uint256 deadline
      ) internal returns(uint) {

          // Get the exchange rate as inputToken per outputToken
          bool _didGet;
          uint _timestamp;
          uint _value;

          (_didGet, _value, _timestamp) = getCurrentValue(_exchange.requestId);

          require(_didGet, "!getCurrentValue");
          require(_timestamp >= block.timestamp - 3600, "!currentValue");
          console.log("Value:", _value);

          // TODO: Safemath or upgrade to solidity v8
          // 1e6 is percision on tellor values, 99/100 gives 1% price slippage
          // TODO: Fix this
          uint256 minOutput = amount  * 1e6 / _value * 9999 / 10000;

          console.log("minOutput:", minOutput);
          _exchange.inputToken.downgrade(amount);
          console.log("Downgraded", amount);

          address inputToken = _exchange.inputToken.getUnderlyingToken();
          address outputToken = _exchange.outputToken.getUnderlyingToken();

          console.log("inputToken", inputToken);
          console.log("outputToken", outputToken);

          address[] memory path = new address[](2);
          // TODO: For eth we have to check of the under
          path[0] = inputToken;
          path[1] = outputToken;

          // approve the router to spend
          ERC20(inputToken).safeIncreaseAllowance(address(_exchange.sushiRouter), amount);

          uint[] memory amounts = _exchange.sushiRouter.swapExactTokensForTokens(
              amount,
              minOutput,
              path,
              address(this),
              deadline
          );

          ERC20(outputToken).safeIncreaseAllowance(address(_exchange.outputToken), amounts[1]);
          _exchange.outputToken.upgrade(amounts[1]);
          console.log("Upgrade", amounts[1]);

          // TODO: Take a small fee

          return amounts[1];
      }

    /**************************************************************************
     * SuperApp callbacks
     *************************************************************************/
    /// @notice  
    /// @dev 
    /// @param 
    /// @return
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
        return _updateOutflow(_ctx, _agreementData);
    }

    /// @notice Handling the SuperApp callback afterAgreementUpdated
    /// @dev 
    /// @param 
    /// @return
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
        if (!_isInputToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx, _agreementData);
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
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
        if (!_isInputToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx, _agreementData);
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _isInputToken(ISuperToken superToken) internal view returns (bool) {
        return address(superToken) == address(_exchange.inputToken);
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _isOutputToken(ISuperToken superToken) internal view returns (bool) {
        return address(superToken) == address(_exchange.outputToken);
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _isCFAv1(address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _isIDAv1(address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    modifier onlyHost() {
        require(msg.sender == address(_exchange.host), "one host");
        _;
    }

    /// @notice 
    /// @dev 
    /// @param 
    /// @return
    modifier onlyExpected(ISuperToken superToken, address agreementClass) {
      if (_isCFAv1(agreementClass)) {
        require(_isInputToken(superToken), "!inputAccepted");
      } else if (_isIDAv1(agreementClass)) {
        require(_isOutputToken(superToken), "!outputAccepted");
      }
      _;
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _createFlow(address to, int96 flowRate) internal {
       _exchange.host.callAgreement(
           _exchange.cfa,
           abi.encodeWithSelector(
               _exchange.cfa.createFlow.selector,
               _exchange.inputToken,
               to,
               flowRate,
               new bytes(0) // placeholder
           ),
           "0x"
       );
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _createFlow(
        address to,
        int96 flowRate,
        bytes memory ctx
    ) internal returns (bytes memory newCtx) {
        (newCtx, ) = _exchange.host.callAgreementWithContext(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.createFlow.selector,
                _exchange.inputToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );
    }

    /// @notice  
    /// @dev 
    /// @param 
    /// @return
    function _updateFlow(address to, int96 flowRate) internal {
        _exchange.host.callAgreement(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.updateFlow.selector,
                _exchange.inputToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    /// @notice  
    /// @dev 
    /// @param to the address to which the stream is going
    /// @param flowRate The updated rate at which the user wants the funds to flow
    /// @param ctx 
    /// @return
    function _updateFlow(
        address to,
        int96 flowRate,
        bytes memory ctx
    ) internal returns (bytes memory newCtx) {
        (newCtx, ) = _exchange.host.callAgreementWithContext(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.updateFlow.selector,
                _exchange.inputToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );
    }

    /// @notice  
    /// @dev 
    /// @param from the address from which the stream is starting
    /// @param to the address to which the stream is going
    /// @return
    function _deleteFlow(address from, address to) internal {
        _exchange.host.callAgreement(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.deleteFlow.selector,
                _exchange.inputToken,
                from,
                to,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    /// @notice Deletes a flow  
    /// @dev 
    /// @param from the address from which the stream is starting
    /// @param to the address to which the stream is going
    /// @param ctx
    /// @return newCtx 
    function _deleteFlow(
        address from,
        address to,
        bytes memory ctx
    ) internal returns (bytes memory newCtx) {
        (newCtx, ) = _exchange.host.callAgreementWithContext(
            _exchange.cfa,
            abi.encodeWithSelector(
                _exchange.cfa.deleteFlow.selector,
                _exchange.inputToken,
                from,
                to,
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );
    }


  }
