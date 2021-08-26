# Ricochet
Ricochet helps you DCA into ETH using Superfluid's ETHx and USDCx. You open a stream of USDCx to Ricochet and you will receive a distribution of ETHx periodically. In this way, you DCA into ETHx using just a single transaction.  

## Getting Started
1. Install Hardhat
2. `npm install`
3. `npx hardhat test`

## Why Ricochet?
Ricochet only requires one DCA transaction per period for all users, reducing collective transaction quantity exponentially.

## Architecture
![Architecture](./00-Meta/arch.png)

# Polygon Contract Addresses

## v1.3
USDC>>WBTC: 0x22CD7fa83Ae3381b66e8011930b92564a8E83366
USDC>>WETH: 0x30Dd5a07eA7B4F9e208FCb5D51FBd15406fC939b
WETH>>USDC: 0x4923dd6C90990cDff5Ca3462cbd43fF57E06f1eb
WBTC>>USDC: 0xD25CBfD04172C8C79c5823bcF14DaB8Fe11C672D

## v1.2 (Deprecated)
DAI>>WETH: 0x27C7D067A0C143990EC6ed2772E7136Cfcfaecd6
WETH>>DAI: 0x5786D3754443C0D3D1DdEA5bB550ccc476FdF11D
