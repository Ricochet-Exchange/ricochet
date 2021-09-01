import {
    ISuperfluid,
    ISuperToken,
    ISuperApp,
    ISuperAgreement,
    SuperAppDefinitions
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";


import {
    IInstantDistributionAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

import "./tellor/ITellor.sol";

library StreamExchangeStorage  {

  struct Stream {
    int96 rate;
  }

  // TODO: This refactoring across all files
  struct TokenPool {
    mapping (address => Stream) streams;  // A lookup table to see how much a user is streaming in
    ISuperToken token;                    // The super token used for this token pool
    uint32 idaIndex;                      // The ida index for this token pool
    int96 totalInflow;                    // The current inflow flow rate for this token pool
  }

  struct StreamExchange {                 // An exchange generate when StreamExchange is deployed
    ISuperfluid host;                     // Superfluid host contract
    IConstantFlowAgreementV1 cfa;         // The stored constant flow agreement class address
    IInstantDistributionAgreementV1 ida;  // The stored instant dist. agreement class address
    ISuperToken subsidyToken;             // The token to use as the subsidy
    uint256 subsidyRate;                  // The number of tokens to distribute subsidy in units per second
    uint32 subsidyIdaIndex;
    uint256 lastDistributionAt;           // The last time a distribution was made
    IUniswapV2Router02 sushiRouter;       // Address of sushsiwap router
    ITellor oracle;                       // Address of deployed simple oracle for input//output token
    uint256 requestId;                    // The id of the tellor request that has input/output exchange rate
    uint128 feeRate;                      // The fee taken as a % with 6 decimals
    address owner;                        // The owner of the exchange
    uint256 rateTolerance;                // The percentage to deviate from the oracle scaled to 1e6

    // NOTE: Token A must be the numerator of the exchange rate (e.g. DAI/ETH, DAI is tokenA)
    TokenPool poolA;
    TokenPool poolB;                   


  }

}
