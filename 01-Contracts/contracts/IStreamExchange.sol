// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStreamExchange {

    function initialize(
        address host,
        address cfa,
        address  ida,
        address inputToken,
        address outputToken,
        address sushiRouter,
        address oracle,
        uint256 requestId
    ) external ;

}
