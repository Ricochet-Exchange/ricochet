async function main() {

  const [keeper] = await ethers.getSigners();
  const TELLOR_CONTRACT_ADDRESS = "0xC79255821DA1edf8E1a8870ED5cED9099bf2eAAA"
  const STREAM_EXCHANGE_HELPER_ADDRESS = "0x0C7776292AB9E95c54282fD74e47d73338c457D8"
  const RICOCHET_CONTRACT_ADDRESS = "0x387af38C133056a0744FB6e823CdB459AE3c5a1f"

  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper")
  const seh = await StreamExchangeHelper.attach(STREAM_EXCHANGE_HELPER_ADDRESS)

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: seh.address,
    },
  });
  const rickoshea = await StreamExchange.attach(RICOCHET_CONTRACT_ADDRESS)

  console.log("getTellorOracle", await rickoshea.getTellorOracle())
  console.log("setOracle", TELLOR_CONTRACT_ADDRESS, await rickoshea.setOracle(TELLOR_CONTRACT_ADDRESS))
  // console.log("getTellorOracle", await rickoshea.getTellorOracle())

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
