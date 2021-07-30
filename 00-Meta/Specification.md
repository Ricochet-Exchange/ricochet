# Ricochet Exchange v2 (Draft)

## Overview
* Ricochet is a stream exchange that uses Superfluid
* Each `RicochetExchange` contract supports two-way streaming swaps
* Streamers can stream either `tokenA` or `tokenB` at any rate and RicochetExchange keepers will trigger swaps periodically
* `RicochetExchange` will perform the following algorithm to swap:
  * Determine the `surplusToken`, which of tokenA or tokenB there's an excess amount of the other token available to swap with
    * Example: consider there is $100 DAI and $50 ETH that's been streamed into the contract
    * ETH is the `surplusToken` because there's _more_ than enough DAI to make the swap
  * Set the other token as the `deficitToken`
    * Consider the above example, DAI is the deficitToken because there's not enough ETH to swap for DAI
  * Next, perform the internal swap, swap the `surplusToken` for the `deficitToken` at the current `exchangeRate`
  * Then, take the remaining amount of the `deficitToken` and swap on Sushiswap
  * Finally, distribute to `tokenA` and `tokenB` their tokens

## Protocol Speciciations

### Structures
* `Oracle`
  * `ITellor oracle` - Address of deployed simple oracle for input//output token
  * `uint256 requestId` - The id of the tellor request that has input/output exchange rate
  * `uint256 rateTolerance` - The percentage to deviate from the oracle scaled to 1e6

* `Exchange`
  * `ISuperfluid host` - Superfluid host contract
  * `IConstantFlowAgreementV1 cfa` - The stored constant flow agreement class address
  * `IInstantDistributionAgreementV1 ida` - The stored instant dist. agreement class address
  * `ISuperToken tokenA` - One of the tokens supported for streaming
  * `ISuperToken tokenB` - The other one of the tokens supported for streaming
  * `int96 totalInflow` - The fee taken as a % with 6 decimals
  * `uint128 feeRate` - The fee taken as a % with 6 decimals
  * `IUniswapV2Router02 sushiRouter` - Address of sushsiwap router to use for swapping
  * `Oracle oracle` - The oracle to use for the exchange
