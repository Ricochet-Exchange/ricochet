import {
    ISuperToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";


import {
    IInstantDistributionAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";


library RicochetLaunchpadStorage  {

  struct InitialRicochetOffering {
    address originator;                         // the address that calls `createIDO`
    address beneficiary;                        // the address that received the `payTokens`
    ISuperToken buyToken;                       // the token sold as part of this IDO
    ISuperToken payToken;                       // the token accepted as part of this IDO
    uint256 rate;                               // the rate to distribute `buyTokens` in tokens/second
    uint256 duration;                           // the duration of the IDO in seconds
    mapping(address => int96) streamersRates;   // maps addresses to flow rates
    int96 totalInflow;                          // the total amount of `payTokens` streaming per second
    bool isActive;                              // True if the IDO has started, False otherwise
    uint256 idaIndex;                           // the index used for the IDA
    uint256 lastDistributionAt;                 // the unix timestamp for the last IDA distribution
  }

  struct RicochetLaunchpad {
    ISuperfluid host;                                       // Superfluid host contract
    IConstantFlowAgreementV1 cfa;                           // The stored constant flow agreement class address
    IInstantDistributionAgreementV1 ida;                    // The stored instant dist. agreement class address
    address owner;                                          // the owner of the Launchpad
    uint128 feeRate;                                        // the fee taken as a % with 6 decimals
    uint256 countIROs;                                      // The number of IROs that have been created
    mapping (ISuperToken => InitialRicochetOffering) iros;  // A dictionary to find the IRO for a given tokenISuperToken
    mapping (ISuperToken => int96) payTokenStreams;         // Maps a pay token to its totalInflow
  }

}
