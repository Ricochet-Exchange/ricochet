async function main() {

  const [owner] = await ethers.getSigners();

  const SLPx = await ethers.getContractFactory("RicochetToken",{
    signer: owner
  });
  const slpx = await SLPx.attach("0x9d5753d8eb0Bc849C695461F866a851F13947CB3")

  await slpx.transferOwnership("0xeb367F6a0DDd531666D778BC096d212a235a6f78")
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
