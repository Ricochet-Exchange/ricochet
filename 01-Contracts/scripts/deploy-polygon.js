async function main() {

  const [deployer] = await ethers.getSigners();
  console.log(process.argv);

  // Polygon Mainnet
  const HOST_ADDRESS = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
  const CFA_ADDRESS = "0x6EeE6060f715257b970700bc2656De21dEdF074C";
  const IDA_ADDRESS = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";
  const TELLOR_ORACLE_ADDRESS = "0xACC2d27400029904919ea54fFc0b18Bf07C57875";
  const RIC_CONTRACT_ADDRESS = "0x263026e7e53dbfdce5ae55ade22493f828922965";

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
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
  console.log("\tINPUT_TOKEN", process.env.INPUT_TOKEN_ADDRESS)
  console.log("\tOUTPUT_TOKEN", process.env.OUTPUT_TOKEN_ADDRESS)
  console.log("\tROUTER_ADDRESS", process.env.ROUTER_ADDRESS)
  console.log("\tTELLOR_ORACLE_ADDRESS", process.env.TELLOR_ORACLE_ADDRESS)
  console.log("\tTELLOR_REQUEST_ID", process.env.TELLOR_REQUEST_ID)
  console.log("\tSF_REG_KEY", process.env.SF_REG_KEY)



  const streamExchange = await StreamExchange.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      process.env.INPUT_TOKEN_ADDRESS,
                                                      process.env.OUTPUT_TOKEN_ADDRESS,
                                                      RIC_CONTRACT_ADDRESS,
                                                      process.env.ROUTER_ADDRESS,
                                                      process.env.TELLOR_ORACLE_ADDRESS,
                                                      process.env.TELLOR_REQUEST_ID,
                                                      process.env.SF_REG_KEY );
  await streamExchange.deployed();
  console.log("Deployed StreamExchangeHelper at address:", sed.address);
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
