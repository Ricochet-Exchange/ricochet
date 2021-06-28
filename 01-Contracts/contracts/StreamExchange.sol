// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
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
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./tellor/UsingTellor.sol";

import "./StreamExchangeStorage.sol";


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
        _exchange.feeRate = 3000;

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

         _exchange.host.callAgreement(
            _exchange.ida,
            abi.encodeWithSelector(
                _exchange.ida.updateSubscription.selector,
                _exchange.outputToken,
                INDEX_ID,
                // one share for the contract to get it started
                msg.sender,
                1,
                new bytes(0) // placeholder ctx
            ),
            new bytes(0) // user data
        );

        _exchange.lastDistributionAt = block.timestamp;
    }


    /**************************************************************************
     * Stream Exchange Logic
     *************************************************************************/

    /// @dev If a new stream is opened, or an existing one is opened
    function _updateOutflow(bytes calldata ctx, bytes calldata agreementData)
        private
        returns (bytes memory newCtx)
    {

      newCtx = ctx;

      // NOTE: Trigger a distribution if there's any inputToken
      console.log("Need to swap this before open new flow",ISuperToken(_exchange.inputToken).balanceOf(address(this)));
      if (ISuperToken(_exchange.inputToken).balanceOf(address(this)) > 0) {
        newCtx = _distribute(newCtx);
      }
      console.log("Updated context");

      (address requester, address flowReceiver) = abi.decode(agreementData, (address, address));
      int96 changeInFlowRate = _exchange.cfa.getNetFlow(_exchange.inputToken, address(this)) - _exchange.totalInflow;

      _exchange.streams[requester].rate = _exchange.streams[requester].rate + changeInFlowRate;

      console.log("Updating IDA");

      console.log("Current Rate", uint(int(_exchange.streams[requester].rate)));
      console.log("Change in rate", uint(int(changeInFlowRate)));

      if (_exchange.streams[requester].rate == 0) {
        // Delete the subscription
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
              uint(int(_exchange.streams[requester].rate)),  // Number of shares is proportional to their rate
              new bytes(0)
          ),
          new bytes(0), // user data
          newCtx
        );
        console.log("Updated share", uint(int(_exchange.streams[requester].rate)));
      }

      _exchange.totalInflow = _exchange.totalInflow + changeInFlowRate;

      // totalInflow / x = (1e6 - feeRate) / 1e6
      // totalInflow * 1e6 = (1e6 - feeRate) * x
      // totalInflow * 1e6 / (1e6 - feeRate) = x

      uint128 ownerShare = uint128((uint(int(_exchange.totalInflow)) * 1e6 / ( 1e6 - _exchange.feeRate)) - uint(int(_exchange.totalInflow)));
      console.log("totalInflow", uint(int(_exchange.totalInflow)));
      console.log("ownerShare", ownerShare);
      // Update the owners share to feeRate
      (newCtx, ) = _exchange.host.callAgreementWithContext(
        _exchange.ida,
        abi.encodeWithSelector(
            _exchange.ida.updateSubscription.selector,
            _exchange.outputToken,
            INDEX_ID,
            owner(),
            ownerShare, // only the fee shares for the owner
            new bytes(0)
        ),
        new bytes(0), // user data
        newCtx
      );


   }


   function getlastDistributionAt() external view returns (uint256) {
     return _exchange.lastDistributionAt;
   }

   function distributeWithContext() internal {

   }

   function distribute() external {
     _distribute(new bytes(0));
   }

   // @dev Distribute a single `amount` of outputToken among all streamers
   // @dev Calculates the amount to distribute
   function _distribute(bytes memory ctx) internal returns (bytes memory newCtx){

      newCtx = ctx;
      require(_exchange.host.isCtxValid(newCtx) || newCtx.length == 0, "!distributeCtx");


      // Compute the amount to distribute
      // TODO: Don't declare so many variables
      uint256 time_delta = block.timestamp - _exchange.lastDistributionAt;

      // NOTE: Swaps all inputToken held, which may not be the best idea?
      uint256 amount = swap(ISuperToken(_exchange.inputToken).balanceOf(address(this)), block.timestamp + 3600);

      (uint256 actualAmount,) = _exchange.ida.calculateDistribution(
       _exchange.outputToken,
       address(this), INDEX_ID,
       amount);

      // Confirm the app has enough to distribute
      require(_exchange.outputToken.balanceOf(address(this)) >= actualAmount, "!enough");

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
        require(_exchange.host.isCtxValid(newCtx) || newCtx.length == 0, "!distribute");
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

      console.log("Distribution amount", actualAmount);
      console.log("Amount", amount);

      _exchange.lastDistributionAt = block.timestamp;

      return newCtx;

    }

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
          uint256 minOutput = amount  * 1e6 / _value;

          _exchange.inputToken.downgrade(amount);
          address inputToken = _exchange.inputToken.getUnderlyingToken();
          address outputToken = _exchange.outputToken.getUnderlyingToken();
          address[] memory path = new address[](2);
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

          // TODO: Take a small fee

          return amounts[1];
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
        if (!_isInputToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx, _agreementData);
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
        if (!_isInputToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx, _agreementData);
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
        if (!_isInputToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx, _agreementData);
    }

    function _isInputToken(ISuperToken superToken) internal view returns (bool) {
        return address(superToken) == address(_exchange.inputToken);
    }

    function _isOutputToken(ISuperToken superToken) internal view returns (bool) {
        return address(superToken) == address(_exchange.outputToken);
    }

    function _isCFAv1(address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    }

    function _isIDAv1(address agreementClass) internal view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
    }

    modifier onlyHost() {
        require(msg.sender == address(_exchange.host), "one host");
        _;
    }

    modifier onlyExpected(ISuperToken superToken, address agreementClass) {
      if (_isCFAv1(agreementClass)) {
        require(_isInputToken(superToken), "!inputAccepted");
      } else if (_isIDAv1(agreementClass)) {
        require(_isOutputToken(superToken), "!outputAccepted");
      }
      _;
    }

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
