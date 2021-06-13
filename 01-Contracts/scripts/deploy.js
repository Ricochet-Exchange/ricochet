async function main() {

  const [deployer] = await ethers.getSigners();

  // Polygon Mainnet
  const HOST_ADDRESS = "0xeD5B5b32110c3Ded02a07c8b8e97513FAfb883B6";
  const CFA_ADDRESS = "0xF4C5310E51F6079F601a5fb7120bC72a70b96e2A";
  const IDA_ADDRESS = "0x32E0ecb72C1dDD92B007405F8102c1556624264D";
  const USDCX_ADDRESS = "0x0F1D7C55A2B133E000eA10EeC03c774e0d6796e8";
  const ETHX_ADDRESS = "0xa623b2DD931C5162b7a0B25852f4024Db48bb1A0";
  const SUSHISWAP_ROUTER_ADDRESS = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  // const TELLOR_ADDRESS = ""


  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());


  // Deploy Tellor Oracle contracts
  const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  const tp = await TellorPlayground.deploy("Tellor oracle", "TRB");
  console.log("Deployed TellorPlayground at address:", tp.address);

  // Set the oracle price
  // await tp.submitValue(1, 2400000000);

  const UsingTellor = await ethers.getContractFactory("UsingTellor");
  const usingTellor = await UsingTellor.deploy(tp.address);
  console.log("Deployed UsingTellor at address:", usingTellor.address);


  console.log("Deploying StreamExchange")
  const StreamExchange = await ethers.getContractFactory("StreamExchange");
  const streamExchange = await StreamExchange.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      USDCX_ADDRESS,
                                                      ETHX_ADDRESS,
                                                      SUSHISWAP_ROUTER_ADDRESS,
                                                      tp.address,
                                                      1, {
        gasPrice: 100,
        gasLimit: 9000000
    });
  console.log("Deployed StreamExchange at address:", streamExchange.address);
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
