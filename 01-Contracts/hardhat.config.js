require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');
require('hardhat-gas-reporter');
require('dotenv').config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async () => {
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
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 21
  },
  mocha: {
    timeout: 1e6,
  },
  networks: {
    polygon: {
      url:  `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [`0x${process.env.MATIC_PRIVATE_KEY}`],
      gas: 2000000,
      gasPrice: 45000000000,
    },
    local: {
      url: 'http://127.0.0.1:7545/',
      accounts: [process.env.MATIC_PRIVATE_KEY],
      gas: 2000000,
      gasPrice: 20000000000
    },
    // kovan: {
    //   url: "https://kovan.infura.io/v3/" + process.env.INFURA_KEY,
    //   accounts: [process.env.PRIVATE_KEY],
    //   gas: 2000000,
    //   gasPrice: 2000000000
    // },
    hardhat: {
      forking: {
        gas: 2000000,
        url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
        accounts: [process.env.MATIC_PRIVATE_KEY],
        // blockNumber: 19403280
      },
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.POLYSCAN_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
};
