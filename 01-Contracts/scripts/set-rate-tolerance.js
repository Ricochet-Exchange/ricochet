async function main() {

  const [keeper] = await ethers.getSigners();
  const RATE_TOLERANCE = "20000"
  const STREAM_EXCHANGE_HELPER_ADDRESS = "0x0C7776292AB9E95c54282fD74e47d73338c457D8"
  const RICOCHET_CONTRACT_ADDRESS = "0xe0B7907FA4B759FA4cB201F0E02E16374Bc523fd"

  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper")
  const seh = await StreamExchangeHelper.attach(STREAM_EXCHANGE_HELPER_ADDRESS)

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: seh.address,
    },
  });
  const ricochet = await StreamExchange.attach(RICOCHET_CONTRACT_ADDRESS)

  console.log("rateTolerance", await ricochet.getRateTolerance())
  console.log("setRateTolerance", RATE_TOLERANCE, await ricochet.setRateTolerance(RATE_TOLERANCE))

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
