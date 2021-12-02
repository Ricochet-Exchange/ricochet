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

  // Output Pools contain information required for ouptut IDA distribute
  struct OutputPool {
      Token token;
      uint128 feeRate;           // Fee taken by the DAO on each output distribution
      uint256 emissionRate;      // Rate to emit tokens if there's a balance, used for subsidies
  }

  // Contains information for oracle updating
  struct OracleInfo {
    uint256 requestId;
    uint256 usdPrice;
    uint256 lastUpdatedAt;
  }

  /// @dev An exchange generate when StreamExchange is deployed
  /// @param host Superfluid host contract
  /// @param cfa The stored constant flow agreement class address
  /// @param ida The stored instant dist. agreement class address
  /// @param inputToken The input token (e.g. DAIx)
  /// @param outputToken The output token (e.g. ETHx)
  /// @param outputIndexId
  /// @param subsidyToken The token to use as the subsidy
  /// @param subsidyRate The number of tokens to distribute subsidy in units per second
  /// @param subsidyIndexId
  /// @param lastDistributionAt The last time a distribution was made
  /// @param sushiRouter Address of sushsiwap router
  /// @param oracle Address of deployed simple oracle for input/output token
  /// @param requestId The id of the tellor request that has input/output exchange rate
  /// @param feeRate The fee taken as a % with 6 decimals
  /// @param owner The owner of the exchange
  /// @param rateTolerance The percentage to deviate from the oracle scaled to 1e6
  struct StreamExchange {
    ISuperfluid host;                     // Superfluid host contract
    IConstantFlowAgreementV1 cfa;         // The stored constant flow agreement class address
    IInstantDistributionAgreementV1 ida;  // The stored instant dist. agreement class address
    ISuperToken inputToken;               // The input token (e.g. DAIx)
    mapping(address => OracleInfo) oracles;           // Maps tokens to their oracle info
    mapping(uint32 => OutputPool) outputPools;   // Maps IDA indexes to their distributed Supertokens
    uint8 numOutputPools;                        // Indexes outputPools and outputPoolFees
    uint256 lastDistributionAt;           // The last time a distribution was made
    IUniswapV2Router02 sushiRouter;       // Address of sushsiwap router
    ITellor oracle;                       // Address of deployed simple oracle for input//output token
    uint256 requestId;                    // The id of the tellor request that has input/output exchange rate
    uint128 feeRate;                      // The fee taken as a % with 6 decimals
    address owner;                        // The owner of the exchange
    uint256 rateTolerance;                // The percentage to deviate from the oracle scaled to 1e6
  }

}
