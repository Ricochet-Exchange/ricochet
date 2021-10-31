async function main() {

  const [owner] = await ethers.getSigners();

  const StreamExchange = await ethers.getContractFactory("StreamExchange", {
    libraries: {
      StreamExchangeHelper: "0xf54bfB9FbE5282766870134E670968116D1c686A",
    },
  });
  const se = await StreamExchange.attach("0xaA40cD75a94E0863f5585fEa9521E320F6ED219b")

  let dr = await se.distribute({nonce:4422});

  console.log("Distribute:", dr);

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
