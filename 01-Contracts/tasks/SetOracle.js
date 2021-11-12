task("SetOracle", "Sets Tellor oracle address")
    .addParam("address", "Address of the StreamExchange contract")
    .addParam("oracle", "Address of the Tellor oracle")
    .setAction(async (taskArgs) => {
        const [owner] = await ethers.getSigners();
        const StreamExchange = await ethers.getContractAt("StreamExchange", taskArgs.address, owner);
        
        try {
            console.log(`Current Tellor oracle address: ${await StreamExchange.getTellorOracle()}`);
            console.log(`Setting Tellor oracle address for StreamExchange at ${StreamExchange.address}...`);

            await StreamExchange.setOracle(taskArgs.oracle);

            console.log(`New Tellor oracle address for StreamExchange at ${StreamExchange.address} set to ${await StreamExchange.getTellorOracle()}`);
        } catch (error) {
            console.error(`Error for StreamExchange contract at ${StreamExchange.address}: ${error.message}`);
        }
    });