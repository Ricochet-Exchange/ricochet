const getRevertReason = require('eth-revert-reason')

async function main() {

  const [keeper] = await ethers.getSigners();

  // Failed with revert reason "Failed test"
  console.log(await getRevertReason('0x5cb0c675661900d15be134038276d62a44e3864e2f685a5939bb854bcbd66649')) // 'Failed test'

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
