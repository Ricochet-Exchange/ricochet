pragma solidity >=0.7.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../tellor/UsingTellor.sol";

contract MockUniswapRouter is UsingTellor {

  address payable oracle;
  uint256 requestId;
  address weth;

  constructor(
      address payable _oracle,
      uint256 _requestId,
      address _weth)
      UsingTellor(_oracle) {

      oracle = _oracle;
      requestId = _requestId;
      weth = _weth;

  }

  function swapExactTokensForTokens(uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline) external returns (uint[] memory amounts)
  {
        // Transfer tokens, assumes we have ETH on this contract
        // NOTE: Assumes exchange rate of
        amounts = new uint[](2);


        // Get the exchange rate as inputToken per outputToken
        bool _didGet;
        uint _timestamp;
        uint _value;

        (_didGet, _value, _timestamp) = getCurrentValue(requestId);

        uint256 amountOut = amountIn * 1e6 / _value;

        require(IERC20(weth).transfer(msg.sender, amountOut), "!transferred");
        // amounts = [0, amountIn / _value / 1e6];
        amounts[0] = 0;
        amounts[1] = amountOut;
        console.log("AmountIn:", amountIn);
        console.log("AmountOut:", amounts[1]);

  }

}
