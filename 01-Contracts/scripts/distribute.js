async function main() {

  const [keeper] = await ethers.getSigners();

  // Update the oracle
  const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  const tp = await TellorPlayground.attach("0xA0c5d95ec359f4A33371a06C23D89BA6Fc591A97");

  let o = await tp.submitValue(1, 1020000);
  console.log("submitValue:", o);

  // Get the StreamExchange contracts
  const StreamExchange = await ethers.getContractFactory("StreamExchange")
  const rickoshea = await StreamExchange.attach("0x3B3775eB7D4EFb5122Bde89B52E9A1a3813bB4F9")


  let dr = await rickoshea.distribute({
    gasPrice: 2000000000,
    gasLimit: 9000000
  });

  console.log("Distribute:", dr);

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
