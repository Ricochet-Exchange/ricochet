async function main() {

  const [deployer] = await ethers.getSigners();
  console.log(process.argv);

  // Polygon Mainnet
  const HOST_ADDRESS = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
  const CFA_ADDRESS = "0x6EeE6060f715257b970700bc2656De21dEdF074C";
  const IDA_ADDRESS = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";
  const TELLOR_ORACLE_ADDRESS = "0xACC2d27400029904919ea54fFc0b18Bf07C57875";
  const RIC_CONTRACT_ADDRESS = "0x263026e7e53dbfdce5ae55ade22493f828922965";
  const INPUT_TOKEN_ADDRESS = "0xCAa7349CEA390F89641fe306D93591f87595dc1F";
  const OUTPUT_TOKEN_ADDRESS = "0xB63E38D21B31719e6dF314D3d2c351dF0D4a9162";
  const ROUTER_ADDRESS = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const TELLOR_REQUEST_ID = 79;

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
  console.log("\tINPUT_TOKEN", INPUT_TOKEN_ADDRESS)
  console.log("\tOUTPUT_TOKEN", OUTPUT_TOKEN_ADDRESS)
  console.log("\tROUTER_ADDRESS", ROUTER_ADDRESS)
  console.log("\tTELLOR_ORACLE_ADDRESS", TELLOR_ORACLE_ADDRESS)
  console.log("\tTELLOR_REQUEST_ID", TELLOR_REQUEST_ID)
  console.log("\tSF_REG_KEY", process.env.SF_REG_KEY)



  const streamExchange = await StreamExchange.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      INPUT_TOKEN_ADDRESS,
                                                      OUTPUT_TOKEN_ADDRESS,
                                                      RIC_CONTRACT_ADDRESS,
                                                      ROUTER_ADDRESS,
                                                      TELLOR_ORACLE_ADDRESS,
                                                      TELLOR_REQUEST_ID,
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
