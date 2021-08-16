async function main() {

  const [keeper] = await ethers.getSigners();
  const TELLOR_CONTRACT_ADDRESS = "0xACC2d27400029904919ea54fFc0b18Bf07C57875"
  const STREAM_EXCHANGE_HELPER_ADDRESS = "0x0C7776292AB9E95c54282fD74e47d73338c457D8"
  const RICOCHET_CONTRACT_ADDRESS = "0x2A7F77D32011fEE97e53F04d7504C6eC49c84e19"

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
