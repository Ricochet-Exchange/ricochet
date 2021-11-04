task("DeployRinkeby", "Deploys stream exchange contracts on Rinkeby testnet")
    .addParam("input", "Input token address")
    .addParam("output", "Output token address")
    .addParam("router", "Router address (UniswapV2 type router) for swapping")
    .addParam("oracle", "Oracle address for the tokens")
    .addParam("requestid", "Request ID for Tellor oracle")
    .addOptionalParam("check", "Checks and skips if the StreamExchange contract has already been deployed", true, types.boolean)
    .setAction(async (taskArgs, hre) => {
        const { deploy } = deployments;
        const [deployer] = await ethers.getSigners();

        // Rinkeby testnet addresses
        const HOST_ADDRESS = "0xeD5B5b32110c3Ded02a07c8b8e97513FAfb883B6";
        const CFA_ADDRESS = "0xF4C5310E51F6079F601a5fb7120bC72a70b96e2A";
        const IDA_ADDRESS = "0x32E0ecb72C1dDD92B007405F8102c1556624264D";
        const RIC_CONTRACT_ADDRESS = "0x369A77c1A8A38488cc28C2FaF81D2378B9321D8B";

        // The following library doesn't use 'check' value as it will most likely remain unchanged
        // and hence no need for re-deployment.
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
                ""
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
                    ""
                ]
            });
        } catch (error) {
            console.log(`${error.message} for StreamExchange at address ${streamExchange.address}`);
        }
    });