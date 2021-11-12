task("Distribute", "Executes distribute function in a particular StreamExchange contract")
    .addParam("address", "StreamExchange contract address")
    .setAction(async (taskArgs) => {
        const [owner] = await ethers.getSigners();
        const StreamExchange = await ethers.getContractAt("StreamExchange", taskArgs.address, owner);
        
        try {
            console.log(`Executing distribute function for StreamExchange contract at ${StreamExchange.address}...`);
            await StreamExchange.distribute();
            console.log(`Distribute function executed for StreamExchange contract at ${StreamExchange.address}`);
        } catch (error) {
            console.error(`Error for StreamExchange contract at ${StreamExchange.address}: ${error.message}`);
        }
    });