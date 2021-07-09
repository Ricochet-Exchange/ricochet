async function main() {

  const [keeper] = await ethers.getSigners();

  // Update the oracle
  const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  const tp = await TellorPlayground.attach("0xC79255821DA1edf8E1a8870ED5cED9099bf2eAAA");

  // let o = await tp.submitValue(1, 2143000000);
  // console.log("submitValue:", o);

  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper")
  const seh = await StreamExchangeHelper.attach("0x0942570634A80bcd096873afC9b112A900492fd7")
  console.log("Deployed StreamExchangeHelper ")

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: seh.address,
    },
  });
  const rickoshea = await StreamExchange.attach("0x7E2E5f06e36da0BA58B08940a72Fd6b68FbDfD61")

  console.log("getOuputToken", await rickoshea.getOuputToken())
  console.log("getInputToken", await rickoshea.getInputToken())


  // let dr = await rickoshea.distribute();

  console.log("Distribute:", dr);

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
