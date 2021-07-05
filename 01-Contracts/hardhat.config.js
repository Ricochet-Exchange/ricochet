require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.3",
  mocha: {
    timeout: 100000
  },
  networks: {
    // polygon: {
    //   url: process.env.POLYGON_QUIKNODE_URL,
    //   accounts: [process.env.PRIVATE_KEY],
    //   gas: 2000000,
    //   gasPrice: 2000000000
    // },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + process.env.INFURA_KEY,
      accounts: [process.env.PRIVATE_KEY],
    },
    // kovan: {
    //   url: "https://kovan.infura.io/v3/" + process.env.INFURA_KEY,
    //   accounts: [process.env.PRIVATE_KEY],
    //   gas: 2000000,
    //   gasPrice: 2000000000
    // },
    hardhat: {
        forking: {
          url: "https://rinkeby.infura.io/v3/" + process.env.INFURA_KEY,
          accounts: [process.env.PRIVATE_KEY_ADMIN, process.env.PRIVATE_KEY_ALICE, process.env.PRIVATE_KEY_BOB],
        }
      }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  }
};
