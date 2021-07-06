// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Ricochet is ERC20, Ownable {

    constructor(address treasury) ERC20("Ricochet", "RIC") {
        _mint(treasury, 10000000 * 10 ** decimals());
    }

}
