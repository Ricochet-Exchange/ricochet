async function main() {

  const [keeper] = await ethers.getSigners();
  const NEW_OWNER = "0x9C6B5FdC145912dfe6eE13A667aF3C5Eb07CbB89"
  const STREAM_EXCHANGE_HELPER_ADDRESS = "0x0C7776292AB9E95c54282fD74e47d73338c457D8"
  const RICOCHET_CONTRACT_ADDRESS = "0x44164bf14213fd0d18ee7fa354a70ee4758e917c"

  const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper")
  const seh = await StreamExchangeHelper.attach(STREAM_EXCHANGE_HELPER_ADDRESS)

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: seh.address,
    },
  });
  const ricochet = await StreamExchange.attach(RICOCHET_CONTRACT_ADDRESS)

  console.log("Current Owner", await ricochet.owner())
  console.log("New Owner", await ricochet.transferOwnership(NEW_OWNER))

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
