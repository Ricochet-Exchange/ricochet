async function main() {

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const [deployer] = await ethers.getSigners();

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


  // Deploy Tellor Oracle contracts
  // const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  // const tp = await TellorPlayground.deploy("Tellor oracle", "TRB");
  // await tp.deployed();
  // console.log("Deployed TellorPlayground at address:", tp.address);
  //
  // // Set the oracle price
  // await tp.submitValue(1, 2400000000);
  //
  // const UsingTellor = await ethers.getContractFactory("UsingTellor");
  // const usingTellor = await UsingTellor.deploy(tp.address);
  // await usingTellor.deployed();
  // console.log("Deployed UsingTellor at address:", usingTellor.address);


  console.log("Deploying StreamExchangeHelper")
  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper");
  let sed = await StreamExchangeHelper.deploy();

  console.log("Deployed StreamExchangeHelper ")
  console.log("Deploying StreamExchange with params")
  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: sed.address,
    },
  });
  console.log("\tHOST_ADDRESS", HOST_ADDRESS)
  console.log("\tCFA_ADDRESS", CFA_ADDRESS)
  console.log("\tIDA_ADDRESS", IDA_ADDRESS)
  // Use USDCx-> DAI on rinkeby
  console.log("\tUSDCX_ADDRESS", USDCX_ADDRESS)
  console.log("\tDAIX_ADDRESS", DAIX_ADDRESS)
  console.log("\tSUSHISWAP_ROUTER_ADDRESS", SUSHISWAP_ROUTER_ADDRESS)
  console.log("\tTELLOR_ORACLE_ADDRESS", TELLOR_ORACLE_ADDRESS)
  console.log("\tTELLOR_REQUEST_ID", TELLOR_REQUEST_ID)
  const streamExchange = await StreamExchange.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      USDCX_ADDRESS,
                                                      DAIX_ADDRESS,
                                                      RIC_CONTRACT_ADDRESS,
                                                      SUSHISWAP_ROUTER_ADDRESS,
                                                      TELLOR_ORACLE_ADDRESS,
                                                      TELLOR_REQUEST_ID,
                                                      "" ); // No SF Reg. Key

  console.log("Deployed StreamExchange at address:", streamExchange.address);
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
