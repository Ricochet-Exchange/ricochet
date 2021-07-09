async function main() {

  const [deployer] = await ethers.getSigners();

  // Rinkeby
  const HOST_ADDRESS = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
  const CFA_ADDRESS = "0x6EeE6060f715257b970700bc2656De21dEdF074C";
  const IDA_ADDRESS = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";
  const USDCX_ADDRESS = "0xCAa7349CEA390F89641fe306D93591f87595dc1F";
  const ETHX_ADDRESS = "0x27e1e4E6BC79D93032abef01025811B7E4727e85";
  const DAIX_ADDRESS = "0x745861AeD1EEe363b4AaA5F1994Be40b1e05Ff90";
  const SUSHISWAP_ROUTER_ADDRESS = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
  const TELLOR_ORACLE_ADDRESS = "";
  const RIC_CONTRACT_ADDRESS = "0x263026e7e53dbfdce5ae55ade22493f828922965";
  const TELLOR_REQUEST_ID = 1;


  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());


  Deploy Tellor Oracle contracts
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
  console.log("\tETHX_ADDRESS", DAIX_ADDRESS)
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
                                                      "" ); // No SF Reg. Key
  await streamExchange.deployed();
  console.log("Deployed StreamExchange at address:", streamExchange.address);
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
