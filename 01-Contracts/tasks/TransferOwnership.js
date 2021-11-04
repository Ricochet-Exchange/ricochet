task("TransferOwnership", "Transfers ownership of StreamExchange type contracts")
    .addParam("address", "StreamExchange contract address")
    .addParam("owner", "Address of the new owner")
    .setAction(async (taskArgs) => {
        const [owner] = await ethers.getSigners();
        const StreamExchange = await ethers.getContractAt("StreamExchange", taskArgs.address, owner);

        try {
            console.log(`Current owner: ${await StreamExchange.owner()}`);
            await StreamExchange.transferOwnership(taskArgs.owner);
            console.log(`New owner: ${await StreamExchange.owner()}`);
        } catch (error) {
            console.error(`Error for StreamExchange contract at ${StreamExchange.address}: ${error.message}`);
        }
    });