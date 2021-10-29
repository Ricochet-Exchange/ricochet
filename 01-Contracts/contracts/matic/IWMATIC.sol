//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;

interface IWMATIC {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}
