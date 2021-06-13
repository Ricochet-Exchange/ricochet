async function main() {

  const [keeper] = await ethers.getSigners();

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
