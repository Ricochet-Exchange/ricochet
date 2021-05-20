pragma solidity ^0.7.1;


interface ISimpleOracle {
    function update() external;
    function consult(address token, uint amountIn) external view returns (uint amountOut);
}
