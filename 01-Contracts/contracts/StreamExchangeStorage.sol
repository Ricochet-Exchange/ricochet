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
import "./sushiswap/IMiniChefV2.sol";

library StreamExchangeStorage  {

  /// @dev Stream structure
  /// @param rate stream rate
  struct Stream {
    int96 rate;
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
    ISuperToken pairToken;                // The pair token of the LP (e.g. ETHx)
    ISuperToken slpToken;                 // The output LP token (e.g. SLPx)
    ISuperToken outputToken;              // The output supertoken used to track SLP credits for users
    ISuperToken sushixToken;             // The token to use as the subsidy
    ISuperToken maticxToken;             // The token to use as the subsidy

    uint32 outputIndexId;
    uint32 sushixIndexId;
    uint32 maticxIndexId;
    ISuperToken subsidyToken;             // The token to use as the subsidy
    uint256 subsidyRate;                  // The number of tokens to distribute subsidy in units per second
    uint32 subsidyIndexId;
    uint256 lastDistributionAt;           // The last time a distribution was made
    IUniswapV2Router02 sushiRouter;       // Address of sushsiwap router
    ITellor oracle;                       // Address of deployed simple oracle for input//output token
    uint256 requestId;                    // The id of the tellor request that has input/output exchange rate
    uint128 feeRate;                      // The fee taken as a % with 6 decimals
    uint128 harvestFeeRate;                      // The fee taken as a % with 6 decimals
    address owner;                        // The owner of the exchange
    uint256 rateTolerance;                // The percentage to deviate from the oracle scaled to 1e6
    IMiniChefV2 miniChef;
    uint256 pid;  // Minichef pool id (1 = ETH/USDC pool)
  }

}
