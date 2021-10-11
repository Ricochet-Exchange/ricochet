async function main() {

  const [deployer] = await ethers.getSigners();
  console.log(process.argv);

  // Polygon Mainnet
  const HOST_ADDRESS = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
  const CFA_ADDRESS = "0x6EeE6060f715257b970700bc2656De21dEdF074C";
  const IDA_ADDRESS = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";
  const RIC_CONTRACT_ADDRESS = "0x263026e7e53dbfdce5ae55ade22493f828922965";
  const RIC_TREASURY_ADDRESS = "0x9C6B5FdC145912dfe6eE13A667aF3C5Eb07CbB89";

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  console.log("Deploying RicochetLaunchpadHelper")
  const RicochetLaunchpadHelper = await ethers.getContractFactory("RicochetLaunchpadHelper");
  let ricochetLaunchpadHelpder = await RicochetLaunchpadHelper.deploy();
  console.log("Deployed RicochetLaunchpadHelper ")

  const RicochetLaunchpad = await ethers.getContractFactory("RicochetLaunchpad", {
    libraries: {
      RicochetLaunchpadHelper: ricochetLaunchpadHelpder.address,
    },
  });
  console.log("Deploying RicochetLaunchpad with params")
  console.log("\tHOST_ADDRESS", HOST_ADDRESS)
  console.log("\tCFA_ADDRESS", CFA_ADDRESS)
  console.log("\tIDA_ADDRESS", IDA_ADDRESS)
  console.log("\tINPUT_TOKEN", process.env.INPUT_TOKEN_ADDRESS)
  console.log("\tOUTPUT_TOKEN", process.env.OUTPUT_TOKEN_ADDRESS)
  console.log("\tSF_REG_KEY", process.env.SF_REG_KEY)



  const ricochetLaunchpad = await RicochetLaunchpad.deploy( HOST_ADDRESS,
                                                      CFA_ADDRESS,
                                                      IDA_ADDRESS,
                                                      process.env.SF_REG_KEY );
  console.log("Deployed app, initializing...", ricochetLaunchpad)
  console.log(process.env.INPUT_TOKEN_ADDRESS,
             process.env.OUTPUT_TOKEN_ADDRESS,
             deployer.address,
             RIC_TREASURY_ADDRESS,
             "15000000000000000",
             "100000")
  await ricochetLaunchpad.initialize(process.env.INPUT_TOKEN_ADDRESS,
                       process.env.OUTPUT_TOKEN_ADDRESS,
                       deployer.address,
                       RIC_TREASURY_ADDRESS,
                       "15000000000000000",
                       "100000");
  await ricochetLaunchpad.deployed();
  console.log("Deployed RicochetLaunchpadHelper at address:", ricochetLaunchpadHelpder.address);
  console.log("Deployed RicochetLaunchpad at address:", ricochetLaunchpad.address);
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
