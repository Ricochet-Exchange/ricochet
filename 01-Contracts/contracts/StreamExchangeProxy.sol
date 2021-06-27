pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "./IStreamExchange.sol";

contract StreamExchangeProxy is TransparentUpgradeableProxy {

  constructor(address _logic, address admin_, bytes memory _data) payable TransparentUpgradeableProxy(_logic, admin_, _data) {
    // Decode the ABI encoded arguments
    (address host,
      address cfa,
      address ida,
      address inputToken,
      address outputToken,
      address sushiRouter) = abi.decode(_data, (
                               address, address, address, address, address, address
                             ));

    // Initialize the StreamExchange
    IStreamExchange(_logic).initialize(host,cfa,ida,inputToken,outputToken,sushiRouter);
  }

}
