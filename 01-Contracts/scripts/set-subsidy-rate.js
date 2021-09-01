async function main() {

  const [keeper] = await ethers.getSigners();
  const RATE_TOLERANCE = "80000000000000000" // 0.08 RIC/sec == 50K RIC/week
  const STREAM_EXCHANGE_HELPER_ADDRESS = "0x0C7776292AB9E95c54282fD74e47d73338c457D8"
  const RICOCHET_CONTRACT_ADDRESS = "0x27C7D067A0C143990EC6ed2772E7136Cfcfaecd6"

  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper")
  const seh = await StreamExchangeHelper.attach(STREAM_EXCHANGE_HELPER_ADDRESS)

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: seh.address,
    },
  });
  const ricochet = await StreamExchange.attach(RICOCHET_CONTRACT_ADDRESS)

  console.log("subsidyRate", (await ricochet.getSubsidyRate()).toString())
  console.log("setSubsidyRate", RATE_TOLERANCE, await ricochet.setSubsidyRate(RATE_TOLERANCE))

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
