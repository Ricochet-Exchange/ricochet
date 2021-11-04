task("DeployPolygon", "Deploys stream exchange contracts on Polygon mainnet")
    .addParam("input", "Input token address")
    .addParam("output", "Output token address")
    .addParam("router", "Router address (UniswapV2 type router) for swapping")
    .addParam("oracle", "Oracle address for the tokens")
    .addParam("requestid", "Request ID for Tellor oracle")
    .addParam("key", "Superfluid registeration key")
    .addOptionalParam("check", "Checks and skips if the StreamExchange contract has already been deployed", true, types.boolean)
    .setAction(async (taskArgs, hre) => {
        const { deploy } = deployments;
        const [deployer] = await ethers.getSigners();

        // Polygon mainnet addresses
        const HOST_ADDRESS = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
        const CFA_ADDRESS = "0x6EeE6060f715257b970700bc2656De21dEdF074C";
        const IDA_ADDRESS = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";
        const RIC_CONTRACT_ADDRESS = "0x263026e7e53dbfdce5ae55ade22493f828922965";


        // The following library doesn't use 'check' value as it will most likely remain unchanged
        // hence no need for re-deployment.
        const streamExchangeHelper = await deploy("StreamExchangeHelper", {
            from: deployer.address,
            skipIfAlreadyDeployed: true // Make this false in case you are sure that the contract doesn't exist
        });

        const streamExchange = await deploy("StreamExchange", {
            from: deployer.address,
            args: [
                HOST_ADDRESS,
                CFA_ADDRESS,
                IDA_ADDRESS,
                taskArgs.input,
                taskArgs.output,
                RIC_CONTRACT_ADDRESS,
                taskArgs.router,
                taskArgs.oracle,
                taskArgs.requestid,
                taskArgs.key
            ],
            libraries: {
                StreamExchangeHelper: streamExchangeHelper.address
            },
            skipIfAlreadyDeployed: taskArgs.check // Make this false in case you are sure that the contract doesn't exist
        });

        console.log("Deployed StreamExchangeHelper at: ", streamExchangeHelper.address);
        console.log("Deployed StreamExchange at: ", streamExchange.address);

        try {
            await hre.run("verify:verify", {
                address: streamExchangeHelper.address
            });
        } catch (error) {
            console.log(`${error.message} for StreamExchangeHelper at address ${streamExchangeHelper.address}`);
        }

        try {
            await hre.run("verify:verify", {
                address: streamExchange.address,
                constructorArguments: [
                    HOST_ADDRESS,
                    CFA_ADDRESS,
                    IDA_ADDRESS,
                    taskArgs.input,
                    taskArgs.output,
                    RIC_CONTRACT_ADDRESS,
                    taskArgs.router,
                    taskArgs.oracle,
                    taskArgs.requestid,
                    taskArgs.key
                ]
            });
        } catch (error) {
            console.log(`${error.message} for StreamExchange at address ${streamExchange.address}`);
        }
    });