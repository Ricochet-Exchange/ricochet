// pragma solidity ^0.8.0;
//
// import "./RicochetLaunchpad.sol";
// import "@optionality.io/clone-factory/contracts/CloneFactory.sol";
// import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
//
// contract RicochetLaunchpadFactory is Ownable, CloneFactory {
//
//   /*Variables*/
//   struct LaunchpadTag {
//     address launchpadAddress;
//   }
//
//   address public launchpadAddress;
//   LaunchpadTag[] private _launchpads;
//
//   event LaunchpadCreated(address newLaunchpadAddress, address owner);
//
//   constructor(address _launchpadAddress) public {
//     launchpadAddress = _launchpadAddress;
//   }
//
//   function createLaunchpad(
//     string memory name,
//     address beneficiary,
//     address buyToken,
//     address payToken,
//     int96 rate,
//     uint256 duration) public returns(address) {
//
//     address clone = createClone(launchpadAddress);
//     RicochetLaunchpad(clone).init(msg.sender, beneficiary, buyToken, payToken, rate, duration);
//     LaunchpadTag memory newLaunchpadTag = LaunchpadTag(clone);
//     _banks.push(newLaunchpadTag);
//     emit LaunchpadCreated(clone, msg.sender);
//   }
//
//   function getNumberOfLaunchpads() public view returns (uint256){
//     return _launchpad.length;
//   }
//
//   function getLaunchpadAddressAtIndex(uint256 index) public view returns (address){
//     LaunchpadTag storage launchpad = _launchpads[index];
//     return launchpad.launchpadAddress;
//   }
//
// }
