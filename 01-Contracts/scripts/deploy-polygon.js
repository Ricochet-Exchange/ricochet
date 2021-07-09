async function main() {

  const [deployer] = await ethers.getSigners();

  // Polygon Mainnet
  // const HOST_ADDRESS = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
  // const CFA_ADDRESS = "0x6EeE6060f715257b970700bc2656De21dEdF074C";
  // const IDA_ADDRESS = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";
  // const USDCX_ADDRESS = "0xCAa7349CEA390F89641fe306D93591f87595dc1F";
  // const ETHX_ADDRESS = "0x27e1e4E6BC79D93032abef01025811B7E4727e85";
  // const SUSHISWAP_ROUTER_ADDRESS = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  // const TELLOR_ORACLE_ADDRESS = "";
  // const RIC_CONTRACT_ADDRESS = "0x263026e7e53dbfdce5ae55ade22493f828922965";
  // const TELLOR_REQUEST_ID = 1;

  // Rinkeby
  const HOST_ADDRESS = "0xeD5B5b32110c3Ded02a07c8b8e97513FAfb883B6";
  const CFA_ADDRESS = "0xF4C5310E51F6079F601a5fb7120bC72a70b96e2A";
  const IDA_ADDRESS = "0x32E0ecb72C1dDD92B007405F8102c1556624264D";
  const USDCX_ADDRESS = "0x0F1D7C55A2B133E000eA10EeC03c774e0d6796e8";
  const ETHX_ADDRESS = "0xa623b2DD931C5162b7a0B25852f4024Db48bb1A0";
  const DAIX_ADDRESS = "0x745861AeD1EEe363b4AaA5F1994Be40b1e05Ff90";
  const SUSHISWAP_ROUTER_ADDRESS = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const TELLOR_ORACLE_ADDRESS = "0xA0c5d95ec359f4A33371a06C23D89BA6Fc591A97";
  const RIC_CONTRACT_ADDRESS = "0x369A77c1A8A38488cc28C2FaF81D2378B9321D8B";
  const TELLOR_REQUEST_ID = 1;


  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // NOTE: Use our own oracle to start, switch to Mesosphere after its ready
  //  Deploy Tellor Oracle contracts
  const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  const tp = await TellorPlayground.deploy("Tellor oracle", "TRB");
  await tp.deployed();
  console.log("Deployed TellorPlayground at address:", tp.address);

  // Set the oracle price
  await tp.submitValue(1, 2154000000);

  const UsingTellor = await ethers.getContractFactory("UsingTellor");
  const usingTellor = await UsingTellor.deploy(tp.address);
  await usingTellor.deployed();
  console.log("Deployed UsingTellor at address:", usingTellor.address);


  console.log("Deploying StreamExchangeHelper")
  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper");
  let sed = await StreamExchangeHelper.deploy();
  console.log("Deployed StreamExchangeHelper ")

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: sed.address,
    },
  });
  console.log("Deploying StreamExchange with params")
  console.log("\tHOST_ADDRESS", HOST_ADDRESS)
  console.log("\tCFA_ADDRESS", CFA_ADDRESS)
  console.log("\tIDA_ADDRESS", IDA_ADDRESS)
  console.log("\tUSDCX_ADDRESS", USDCX_ADDRESS)
  console.log("\tETHX_ADDRESS", ETHX_ADDRESS)
  console.log("\tSUSHISWAP_ROUTER_ADDRESS", SUSHISWAP_ROUTER_ADDRESS)
  console.log("\tTELLOR_ORACLE_ADDRESS", tp.address)
  console.log("\tTELLOR_REQUEST_ID", TELLOR_REQUEST_ID)
  const streamExchange = await StreamExchange.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      USDCX_ADDRESS,
                                                      ETHX_ADDRESS,
                                                      RIC_CONTRACT_ADDRESS,
                                                      SUSHISWAP_ROUTER_ADDRESS,
                                                      tp.address,
                                                      TELLOR_REQUEST_ID,
                                                      "RicochetFTW" ); // No SF Reg. Key
  await streamExchange.deployed();
  console.log("Deployed StreamExchange at address:", streamExchange.address);
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});


// 2021-07-09
// Deploying contracts with the account: 0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA
// Account balance: 849999829910704000000
// Deployed TellorPlayground at address: 0xC79255821DA1edf8E1a8870ED5cED9099bf2eAAA
// Deployed UsingTellor at address: 0x5417566b07Aa55e083F89b92FA4E55CB520A414c
// Deploying StreamExchangeHelper
// Deployed StreamExchangeHelper
// Deploying StreamExchange with params
// 	HOST_ADDRESS 0x3E14dC1b13c488a8d5D310918780c983bD5982E7
// 	CFA_ADDRESS 0x6EeE6060f715257b970700bc2656De21dEdF074C
// 	IDA_ADDRESS 0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1
// 	USDCX_ADDRESS 0xCAa7349CEA390F89641fe306D93591f87595dc1F
// 	ETHX_ADDRESS 0x27e1e4E6BC79D93032abef01025811B7E4727e85
// 	SUSHISWAP_ROUTER_ADDRESS 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506
// 	TELLOR_ORACLE_ADDRESS 0xC79255821DA1edf8E1a8870ED5cED9099bf2eAAA
// 	TELLOR_REQUEST_ID 1
// Deployed StreamExchange at address: 0x7E2E5f06e36da0BA58B08940a72Fd6b68FbDfD61
