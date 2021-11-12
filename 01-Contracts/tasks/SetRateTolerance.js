task("SetRateTolerance", "Sets rate tolerance in a StreamExchange contract")
    .addParam("address", "Address of the StreamExchange contract")
    .addParam("rate", "Rate to set in the StreamExchange contract")
    .setAction(async (taskArgs) => {
        const [owner] = await ethers.getSigners();
        const StreamExchange = await ethers.getContractAt("StreamExchange", taskArgs.address, owner);

        try {
            console.log(`Current rate tolerance: ${await StreamExchange.getRateTolerance()}`);
            console.log(`Setting rate tolerance to: ${taskArgs.rate}...`);

            await StreamExchange.setRateTolerance(taskArgs.rate);

            console.log(`Rate tolerance set to ${await StreamExchange.getRateTolerance()}`);
        } catch (error) {
            console.error(`Error for StreamExchange contract at ${StreamExchange.address}: ${error.message}`);
        }
    });