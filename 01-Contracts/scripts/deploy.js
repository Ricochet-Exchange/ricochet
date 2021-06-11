async function main() {

  const [deployer] = await ethers.getSigners();

  // TODO: Confirm these are the address for the right network
  const HOST_ADDRESS = "0xF0d7d1D47109bA426B9D8A3Cde1941327af1eea3";
  const CFA_ADDRESS = "0xECa8056809e7e8db04A8fF6e4E82cD889a46FE2F";
  const IDA_ADDRESS = "0x556ba0b3296027Dd7BCEb603aE53dEc3Ac283d2b";
  const USDCX_ADDRESS = "0x25b5cd2e6ebaedaa5e21d0ecf25a567ee9704aa7";
  const ETHX_ADDRESS = "0xdd5462a7db7856c9128bc77bd65c2919ee23c6e1";
  const SUSHISWAP_ROUTER_ADDRESS = "";
  const TELLOR_ADDRESS = ""


  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());


  console.log("Deploying StreamExchange")
  const StreamExchange = await ethers.getContractFactory("StreamExchange");
  const streamExchange = await StreamExchange.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      USDCX_ADDRESS,
                                                      ETHX_ADDRESS,
                                                      SUSHISWAP_ROUTER_ADDRESS,
                                                      TELLOR_ADDRESS
                                                      1);
  console.log("Deployed StreamExchange at address:", streamExchange.address);
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
