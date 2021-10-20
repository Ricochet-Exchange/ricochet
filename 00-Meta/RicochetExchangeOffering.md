# REX Launchpad
## What is it?
The Launchpad contract allows projects to list their token for streaming sale, or a sale where many individuals stream to receive a distribution of tokens at a fixed rate. The launchpad supports a streaming auction where the price is determined by the markets total stream rate.

### Example
Token project wants do a initial offering, they launch on the Launchpad and they get a few streamers:
```
0xA -- 100 USDCx/mo. -->                   -- 25000 TOK/mo. --> 0xA
0xB -- 100 USDCx/mo. -->  TOK on Launchpad -- 25000 TOK/mo. --> 0xB
0xC -- 200 USDCx/mo. -->  (100000 TOK/mo.) -- 50000 TOK/mo. --> 0xC
```
### Price Discovery
Rather than price discovery happening on a limit order book, it happens using a auctions where participants can stream any amount and receive a proportional amount of the token being launched.

The price of TOK is the sum of streams divided by the distribution rate. Consider the price of `TOK` in the above example:
```
(100 + 100 + 200) = 400 USDCx/mo.
400 USDCx / 100000 TOK = 0.004 USDCx
```
The price of the token at launch would be 0.004 USDCx per token (250 tokens per USDCx).

## Contract Architecture

### Overview
* REX Launchpad allows anyone to launch a token sale (IRO)
* The user that creates a new IRO is called the `originator`
* The users who participate in the IRO are called `streamers`
* The IRO is defined by the following parameters:
  * An `beneficiary` address that will receive the proceeds of the sale
  * The contract address of the `buyToken` being offered
  * The contract address of the `payToken` used to purchase the `buyToken`
  * The `rate` in tokens per second to distribute tokens to `streamers`
  * A `duration` in seconds for the IRO to run
* To create a new IRO the `originator` must:
  * `approve` REX Launchpad to transfer `rate * duration` `buyTokens`
  * Call `createIRO` method on the REX Launchpad with the parameters listed above
* Once the REX IRO is created:
  * `streamers` can open a stream to REX Launch pad
  * `payTokens` flow from `streamers` directly to the `beneficiary` using Superfluid CFA
  * `buyTokens` are distributed to `streamers` periodically using Superfluid IDA
* `streamers` pass in the `buyToken` address as `userData` when starting/stoping streams to the Launchpad
* IROs

### Structures

**`IRO`** - Models a single REX Launchpad IRO
* `address originator` - the address that calls `createIRO`
* `address beneficiary` - the address that received the `payTokens`
* `address buyToken` - the token sold as part of this IRO
* `address payToken` - the token accepted as part of this IRO
* `int96 rate` - the rate to distribute `buyTokens` in tokens/second
* `uint256 duration` - the duration of the IRO in seconds
* `mapping(address => int96) streamers` - maps addresses to flow rates
* `int96 totalInflow` - the total amount of `payTokens` streaming per second
* `uint256 idaIndex` - The index for the IDA
* `uint256 lastDistributionAt` - The unix timestamp for the last IDA distribution

**`Launchpad`** - Models the REX Launchpad
* `address owner` - the owner of the Launchpad
* `uint128 feeRate` - the fee taken as a % with 6 decimals
* `ISuperfluid host` - Superfluid host contract
* `IConstantFlowAgreementV1 cfa` - The stored constant flow agreement class address
* `IInstantDistributionAgreementV1 ida` - The stored instant dist. agreement class address
* `mapping(address => IRO) iros` - A mapping that maps the `buyToken` address to it's IRO
* `mapping(address => IRO) payTokenStreams` - A mapping that maps the `payTokens` address to the current Launchpad inflow rate
* `uint256 countIROs` - The number of IROs created, used to set the ida index

### Modifiers
* `onlyOriginator(ISuperToken buyToken)` - requires `msg.sender` to the originator of the `buyToken`
* `onlyOwner` - requires `msg.sender` to be the owner of Ricochet Launchpad

### Events
* `NewIRO` - Emits when a new IRO is created in `createIDO` method
* `UpdatedStream` - Emits when a streamer starts/edits/stops their stream
* `Distribution` - Emits when a IDA distribution is triggered for a IRO

### Methods
**createIRO(address beneficiary, address payToken, address buyToken, int96 rate, uint duration)**
* Parameters
  * `beneficiary` - the address that received the `payTokens`
  * `buyToken` - the token sold as part of this IRO
  * `payToken` - the token accepted as part of this IRO
  * `rate` - the rate to distribute `buyTokens` in tokens/second
  * `duration` - the duration of the IRO in seconds
* Pre-conditions
  * There does not exist another IRO with the same `buyToken`
  * `msg.sender` has `rate * duration` `buyTokens`
  * `msg.sender` has approved this contract to spend `rate * duration` `buyTokens`
* Post-conditions
  * A new `IRO`is created and added to the `Launchpad` `iros` mapping
  * A new IDA pool is created for the `buyToken` and 1 share is added for the `beneficiary`

**destroyIRO(address buyToken)**
* Parameters
  * `buyToken` - the token sold as part of this IRO
* Preconditions
  * This IROs `totalInflow == 0`
* Postconditions
  * The IRO at in `iros` are cleared
  * The remain `buyTokens` are returned to the `originator`


**distribute(address buyToken)**
* Parameters
  * `buyToken` - the token sold as part of this IRO
* Preconditions
  * There exists an IRO for the `buyToken`
  * There is enough `buyToken` to do a distribution
* Postconditions
  * Streamers in the IRO's IDA pool receive their `buyTokens`

**closeStream(address buyToken, address streamer)**
* Parameters
  * `buyToken` - the token sold as part of this IRO
  * `streamer` - the address of a streamer
* Preconditions
  * EITHER the contract `isJailed`
  * OR the IRO for `buyToken` has run out of tokens to sell
* Postconditions
  * The `streamers` stream is closed
  * The streamer is unsubscribed from the IDA pool

**_updateFlow(bytes calldata ctx, bytes calldata agreementData, address buyToken)**
* Parameters
  * `ctx` - the Superfluid context
  * `agreementData` - the Superfluid agreement data
  * `buyToken` - the `buyToken` this streamer is streaming to receive
* Preconditions
  * There exists a IRO for `buyToken` and it `isActive`
* Postconditions
  * A `distribute` is triggered before updating anything
  * The streamer's address is added to the IRO's streamers
  * The `totalInflow` is updated to include this streamers flow rate
  * The streamer's is added to the IDA pool
  * The outflow stream to the IRO's `beneficiary` is updated
  * The outflow stream to the Launchpad's `owner` is updated so the fee is taken
