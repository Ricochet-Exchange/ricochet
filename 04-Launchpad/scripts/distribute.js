async function main() {

  const [owner] = await ethers.getSigners();



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
