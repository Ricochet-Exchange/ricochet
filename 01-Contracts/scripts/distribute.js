async function main() {

  const [keeper] = await ethers.getSigners();

  // Update the oracle
  const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
  const tp = await TellorPlayground.attach("0xA0c5d95ec359f4A33371a06C23D89BA6Fc591A97");

  let o = await tp.submitValue(1, 2400000000);
  console.log("submitValue:", o);

  // Get the StreamExchange contracts
  const StreamExchange = await ethers.getContractFactory("StreamExchange")
  const rickoshea = await StreamExchange.attach("0x02c35123C2756e562995f00299c11AAF92EBF268")


  let dr = await rickoshea.distribute();
  console.log("Distribute:", dr);

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
