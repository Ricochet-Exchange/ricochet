async function main() {

  const [keeper] = await ethers.getSigners();

  // Update the oracle
  const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  const tp = await TellorPlayground.attach("0x75ab1058D4cbE1E5996B2a53c1967B95A870AA46");

  let o = await tp.submitValue(1, 2400000000);
  console.log("submitValue:", o);

  // Get the StreamExchange contracts
  const StreamExchange = await ethers.getContractFactory("StreamExchange")
  const rickoshea = await StreamExchange.attach("0x70d1dd07a47Ec1CBc7619Ab150E31b448D422ce8")


  // Approve the app to work


  let dr = await rickoshea.distribute();
  console.log("Distribute:", dr);
  // Trigger the distribute() method on StreamExchange
  // Track the balances in the app before and after the triggering


}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
