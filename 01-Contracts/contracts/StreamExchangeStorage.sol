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


library StreamExchangeStorage  {

  struct Stream {
    int96 rate;
  }

  struct StreamExchange {                 // An exchange generate when StreamExchange is deployed
    ISuperfluid host;                     // Superfluid host contract
    IConstantFlowAgreementV1 cfa;         // The stored constant flow agreement class address
    IInstantDistributionAgreementV1 ida;  // The stored instant dist. agreement class address
    ISuperToken inputToken;               // The input token (e.g. DAIx)
    ISuperToken outputToken;              // The output token (e.g. ETHx)
    int96 totalInflow;                    // The current inflow flow rate for the superapp
    uint256 lastDistributionAt;           // The last time a distribution was made
    uint256 rate;                         // The exchange rate
    mapping (address => Stream) streams;  // A lookup table to see how much a user is streaming in
    IUniswapV2Router02 sushiRouter;       // Address of sushsiwap router
    address payable oracle;               // Address of deployed simple oracle for input//output token
    uint256 requestId;                    // The id of the tellor request that has input/output exchange rate
    uint128 feeRate;                      // The fee takens as a
  }

}
