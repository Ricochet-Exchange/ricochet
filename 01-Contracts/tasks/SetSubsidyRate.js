task("SetSubsidyRate", "Sets subsidy rate in a StreamExchange contract")
    .addParam("address", "Address of the StreamExchange contract")
    .addParam("rate", "Rate to set in the StreamExchange contract")
    .setAction(async (taskArgs) => {
        const [owner] = await ethers.getSigners();
        const StreamExchange = await ethers.getContractAt("StreamExchange", taskArgs.address, owner);

        try {
            console.log(`Current subsidy rate: ${await StreamExchange.getSubsidyRate()}`);
            console.log(`Setting subsidy rate to: ${taskArgs.rate}...`);

            await StreamExchange.setSubsidyRate(taskArgs.rate);

            console.log(`Subsidy rate set to ${await StreamExchange.getSubsidyRate()}`);
        } catch (error) {
            console.error(`Error for StreamExchange contract at ${StreamExchange.address}: ${error.message}`);
        }
    });