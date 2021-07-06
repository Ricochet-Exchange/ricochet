// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import {
    ISuperfluid,
    ISuperToken,
    ISuperTokenFactory
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { ERC20WithTokenInfo } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/ERC20WithTokenInfo.sol";

contract SuperRicochet {

    event NewSuperToken(address _contractAddress);
    mapping (address => address) superTokenRegistry;

    ISuperfluid private _host;

    constructor(address _sfHost) {
        _host = ISuperfluid(_sfHost);
    }

    function createSuperToken(ERC20WithTokenInfo token) public returns (ISuperToken superToken) {

        // name: Super Fake Maker
        // symbol: MKRtx

        string memory name = string(abi.encodePacked('Super ', token.name()));
        string memory symbol = string(abi.encodePacked(token.symbol(), 'x'));

        ISuperTokenFactory factory = _host.getSuperTokenFactory();
        superToken = factory.createERC20Wrapper(token,ISuperTokenFactory.Upgradability.FULL_UPGRADABE,name,symbol);

        superTokenRegistry[address(token)] = address(superToken);
        emit NewSuperToken(address(superToken));

    }

    function getSuperToken(ERC20WithTokenInfo unwrappedToken) public view returns (address superTokenAddress) {

        superTokenAddress = superTokenRegistry[address(unwrappedToken)];

    }

}
