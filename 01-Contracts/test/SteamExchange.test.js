const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");
const { expect } = require("chai");
const axios = require('axios').default;
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const SuperfluidSDK = require("@superfluid-finance/js-sdk");
const traveler = require("ganache-time-traveler");

const superTokenAbi=[{"inputs":[{"internalType":"contract ISuperfluid","name":"host","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"bytes","name":"state","type":"bytes"}],"name":"AgreementAccountStateUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":false,"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"AgreementCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"penaltyAccount","type":"address"},{"indexed":true,"internalType":"address","name":"rewardAccount","type":"address"},{"indexed":false,"internalType":"uint256","name":"rewardAmount","type":"uint256"}],"name":"AgreementLiquidated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"liquidatorAccount","type":"address"},{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"penaltyAccount","type":"address"},{"indexed":true,"internalType":"address","name":"bondAccount","type":"address"},{"indexed":false,"internalType":"uint256","name":"rewardAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bailoutAmount","type":"uint256"}],"name":"AgreementLiquidatedBy","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"uint256","name":"slotId","type":"uint256"}],"name":"AgreementStateUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"AgreementTerminated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":false,"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"AgreementUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"tokenHolder","type":"address"}],"name":"AuthorizedOperator","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"bailoutAccount","type":"address"},{"indexed":false,"internalType":"uint256","name":"bailoutAmount","type":"uint256"}],"name":"Bailout","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"Burned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"uuid","type":"bytes32"},{"indexed":false,"internalType":"address","name":"codeAddress","type":"address"}],"name":"CodeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"Minted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"tokenHolder","type":"address"}],"name":"RevokedOperator","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"Sent","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenDowngraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenUpgraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"authorizeOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"createAgreement","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"defaultOperators","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"downgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"getAccountActiveAgreements","outputs":[{"internalType":"contract ISuperAgreement[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"agreementClass","type":"address"},{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"uint256","name":"dataLength","type":"uint256"}],"name":"getAgreementData","outputs":[{"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"agreementClass","type":"address"},{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"slotId","type":"uint256"},{"internalType":"uint256","name":"dataLength","type":"uint256"}],"name":"getAgreementStateSlot","outputs":[{"internalType":"bytes32[]","name":"slotData","type":"bytes32[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCodeAddress","outputs":[{"internalType":"address","name":"codeAddress","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getHost","outputs":[{"internalType":"address","name":"host","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getUnderlyingToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"granularity","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"underlyingToken","type":"address"},{"internalType":"uint8","name":"underlyingDecimals","type":"uint8"},{"internalType":"string","name":"n","type":"string"},{"internalType":"string","name":"s","type":"string"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"isAccountCritical","outputs":[{"internalType":"bool","name":"isCritical","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isAccountCriticalNow","outputs":[{"internalType":"bool","name":"isCritical","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"isAccountSolvent","outputs":[{"internalType":"bool","name":"isSolvent","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isAccountSolventNow","outputs":[{"internalType":"bool","name":"isSolvent","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"isOperatorFor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"address","name":"liquidator","type":"address"},{"internalType":"address","name":"penaltyAccount","type":"address"},{"internalType":"uint256","name":"rewardAmount","type":"uint256"},{"internalType":"uint256","name":"bailoutAmount","type":"uint256"}],"name":"makeLiquidationPayouts","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationApprove","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationDowngrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationUpgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"operatorBurn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"operatorSend","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"proxiableUUID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"realtimeBalanceOf","outputs":[{"internalType":"int256","name":"availableBalance","type":"int256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint256","name":"owedDeposit","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"realtimeBalanceOfNow","outputs":[{"internalType":"int256","name":"availableBalance","type":"int256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint256","name":"owedDeposit","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"revokeOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"userData","type":"bytes"}],"name":"selfBurn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"userData","type":"bytes"}],"name":"selfMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"send","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"int256","name":"delta","type":"int256"}],"name":"settleBalance","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"uint256","name":"dataLength","type":"uint256"}],"name":"terminateAgreement","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"}],"name":"transferAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"holder","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"updateAgreementData","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"slotId","type":"uint256"},{"internalType":"bytes32[]","name":"slotData","type":"bytes32[]"}],"name":"updateAgreementStateSlot","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAddress","type":"address"}],"name":"updateCode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"upgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeTo","outputs":[],"stateMutability":"nonpayable","type":"function"}]

// Prerequesites
// 1. Setup Alice, Bob, and Carl with some inputTokens and NO outputTokens
// 2. Owner needs some MATIC to deploy and show hold NO outputTokens

const RIC_TOKEN_ADDRESS = process.env.RIC_TOKEN_ADDRESS
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS
const TELLOR_ORACLE_ADDRESS = process.env.TELLOR_ORACLE_ADDRESS
const TELLOR_REQUEST_ID = process.env.TELLOR_REQUEST_ID
const SF_REG_KEY = process.env.SF_REG_KEY
const COINGECKO_TOKEN_ID = process.env.COINGECKO_TOKEN_ID

const CARL_ADDRESS = "0x8c3bf3EB2639b2326fF937D041292dA2e79aDBbf"
const BOB_ADDRESS = "0x00Ce20EC71942B41F50fF566287B811bbef46DC8"
const ALICE_ADDRESS = "0x9f348cdD00dcD61EE7917695D2157ef6af2d7b9B"
const OWNER_ADDRESS = "0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA"

// MKR ETH LP: 0x5E8f882dD0d062e2d81bcBe4EC61d7AEaBf80c74


describe("StreamExchange", () => {
    const errorHandler = (err) => {
        if (err) throw err;
    };

    const names = ["Admin", "Alice", "Bob", "Carl"];
    let inputTokenAddress = process.env.INPUT_TOKEN_ADDRESS;  // DAI
    let outputTokenAddress = process.env.OUTPUT_TOKEN_ADDRESS; // MKR
    let inputToken;  // DAI
    let inputTokenUnderlying;  // DAI
    let outputToken; // MKR
    let outputTokenUnderlying; // MKR
    let appBalances = {};
    let appDeltas = {};

    let sf;
    let ric;
    let app;
    let tp; // Tellor playground
    let usingTellor;
    let sr;
    let ricAddress = "0x263026e7e53dbfdce5ae55ade22493f828922965";
    const u = {}; // object with all users
    const aliases = {};
    let owner;
    let alice;
    let bob;
    let carl;
    let oraclePrice;

    before(async function () {
        //process.env.RESET_SUPERFLUID_FRAMEWORK = 1;
        let response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids='+COINGECKO_TOKEN_ID+'&vs_currencies=usd')
        oraclePrice =  parseInt(response.data[COINGECKO_TOKEN_ID].usd * 1.05 * 1000000).toString()
        console.log("oraclePrice", oraclePrice)
    });

    beforeEach(async function () {
      this.timeout(1000000);

      // Initialize SF
      sf = new SuperfluidSDK.Framework({
          web3,
          resolverAddress: "0xE0cc76334405EE8b39213E620587d815967af39C",
          tokens: ["DAI"],
          version: "v1"
      });
      await sf.initialize();

      // Setup Users
      // Admin
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [OWNER_ADDRESS]}
      )
      owner = await ethers.provider.getSigner(OWNER_ADDRESS)
      await deployFramework(errorHandler, {
          web3,
          from: owner.address,
      });
      // Alice
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ALICE_ADDRESS]}
      )
      alice = await ethers.provider.getSigner(ALICE_ADDRESS)

      // Bob
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [BOB_ADDRESS]}
      )
      bob = await ethers.provider.getSigner(BOB_ADDRESS)

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [CARL_ADDRESS]}
      )
      carl = await ethers.provider.getSigner(CARL_ADDRESS)

      // Setup contract connections
      console.log(inputTokenAddress);
      console.log(outputTokenAddress)
      inputToken = await ethers.getContractAt(superTokenAbi, inputTokenAddress);
      outputToken = await ethers.getContractAt(superTokenAbi, outputTokenAddress);
      ric = await ethers.getContractAt(superTokenAbi, RIC_TOKEN_ADDRESS);
      ric = ric.connect(owner)

      const ERC20 = await ethers.getContractFactory("ERC20");
      inputTokenUnderlying = await ERC20.attach(await inputToken.getUnderlyingToken());
      outputTokenUnderlying = await ERC20.attach(await outputToken.getUnderlyingToken());

      const accounts = [owner, alice, bob, carl];

      // Setup users and setup to track user balances
      for (var i = 0; i < names.length; i++) {

          u[names[i].toLowerCase()] = sf.user({
              address: accounts[i]._address || accounts[i].address,
              token: inputToken.address
          });

          u[names[i].toLowerCase()].alias = names[i];
          aliases[u[names[i].toLowerCase()].address] = names[i];

          appBalances[names[i]] = {}
          appBalances[names[i]][inputToken.address] = [];
          appBalances[names[i]][outputToken.address] = [];
          appDeltas[names[i]] = {}
          appDeltas[names[i]][inputToken.address] = [];
          appDeltas[names[i]][outputToken.address] = [];
      }



      console.log("Owner:", u.admin.address);
      console.log("Host:", sf.host.address);
      console.log("Input Token: ", inputToken.address);
      console.log("Output Token: ", outputToken.address);
      console.log("Tellor Oracle Address:", TELLOR_ORACLE_ADDRESS)

      console.log(sf.host.address,
                  sf.agreements.cfa.address,
                  sf.agreements.ida.address,
                  inputToken.address,
                  outputToken.address,
                  RIC_TOKEN_ADDRESS,
                  ROUTER_ADDRESS,
                  TELLOR_ORACLE_ADDRESS,
                  TELLOR_REQUEST_ID,
                  SF_REG_KEY);

      // Deploy Contracts
      const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
      tp = await TellorPlayground.attach(TELLOR_ORACLE_ADDRESS);

      const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper");
      let sed = await StreamExchangeHelper.deploy();

      const StreamExchange = await ethers.getContractFactory("StreamExchange", {
        libraries: {
          StreamExchangeHelper: sed.address,
        },
        signer: owner
      });
      tp = tp.connect(owner)



      app = await StreamExchange.deploy(sf.host.address,
                                        sf.agreements.cfa.address,
                                        sf.agreements.ida.address,
                                        inputToken.address,
                                        outputToken.address,
                                        RIC_TOKEN_ADDRESS,
                                        ROUTER_ADDRESS, //sr.address,
                                        TELLOR_ORACLE_ADDRESS,
                                        TELLOR_REQUEST_ID,
                                        SF_REG_KEY);
      console.log("Deployed StreamExchange.")

      // Setup an app user for the deployed contract
      u.app = sf.user({ address: app.address, token: inputToken.address });
      u.app.alias = "App";
      await checkBalance(u.app);

      // Approve IDA tokens, loop all output tokens for all users
      let tokens = [outputToken.address, ric.address]
      let users = [u.alice.address, u.bob.address, u.carl.address, u.admin.address]
      for (let t = 0; t < tokens.length; t++) {
        for (let u = 0; u < users.length; u++) {
          let index = 0
          if (tokens[t] == ricAddress) {
            index = 1
          }

          await web3tx(
              sf.host.callAgreement,
              users[u] + " approves subscription to the app " + tokens[t] + " " + index
          )(
              sf.agreements.ida.address,
              sf.agreements.ida.contract.methods
                  .approveSubscription(tokens[t], app.address, t, "0x")
                  .encodeABI(),
              "0x", // user data
              {
                  from: users[u]
              }
          );
        }
      }

    });

    async function checkBalance(user) {
        console.log("Balance of ", user.alias);
        console.log("Input Token Balance: ", (await inputToken.balanceOf(user.address)).toString());
        console.log("Ouput Token Balance: ", (await outputToken.balanceOf(user.address)).toString());
    }

    async function checkBalances(accounts) {
        for (let i = 0; i < accounts.length; ++i) {
            await checkBalance(accounts[i]);
        }
    }


    async function takeMeasurements() {

      // Setup users and setup to track user balances
      for (var i = 0; i < names.length; i++) {
          appBalances[names[i]][inputToken.address].push((await inputToken.balanceOf(u[names[i].toLowerCase()].address)).toString());
          appBalances[names[i]][outputToken.address].push((await outputToken.balanceOf(u[names[i].toLowerCase()].address)).toString());
      }
      // Setup users and setup to track user balances
      if (appBalances[names[0]][inputToken.address].length >= 2) {
        for (var i = 0; i < names.length; i++) {
            let l = appDeltas[names[i]][inputToken.address].length-1
            console.log("Changein", appDeltas[names[i]][inputToken.address][l])
            console.log("Changein", appDeltas[names[i]][inputToken.address][l-1])
            console.log("Changeout", appDeltas[names[i]][outputToken.address][l])
            console.log("Changeout", appDeltas[names[i]][outputToken.address][l-1])
            let changeInInToken = appDeltas[names[i]][inputToken.address][l-1] - appDeltas[names[i]][inputToken.address][l]
            let changeInOutToken = appDeltas[names[i]][outputToken.address][l] - appDeltas[names[i]][outputToken.address][l-1]

            appDeltas[names[i]][inputToken.address].push((await inputToken.balanceOf(u[names[i].toLowerCase()].address)).toString());
            appDeltas[names[i]][outputToken.address].push((await outputToken.balanceOf(u[names[i].toLowerCase()].address)).toString());
            console.log("Change in balances for ", names[i])
            console.log("Input Token:", changeInInToken, "Bal:", appDeltas[names[i]][inputToken.address][i])
            console.log("Output Token:", changeInOutToken, "Bal:", appDeltas[names[i]][outputToken.address][i])
            console.log("Exchange Rate:", changeInInToken/changeInOutToken)
        }
      }
    }

    async function delta() {



    }

    describe("Stream Exchange", async function () {
      this.timeout(1000000);

      it("should stream the same amount to all streamers with the same rates", async function() {

        // Checks for unlimited approval
        expect(await inputTokenUnderlying.allowance(app.address, ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
        expect(await outputTokenUnderlying.allowance(app.address, ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
        expect(await inputTokenUnderlying.allowance(app.address, inputToken.address)).to.be.equal(ethers.constants.MaxUint256);
        expect(await outputTokenUnderlying.allowance(app.address, outputToken.address)).to.be.equal(ethers.constants.MaxUint256);


        let inflowRate = "1000000000000000";
        let inflowRate2x = "2000000000000000";
        await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        // await u.carl.flow({ flowRate: inflowRate, recipient: u.app });

        for(var i = 0; i < 3; i++) {
          await traveler.advanceTimeAndBlock(60*60*1);
          await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
          await app.distribute()
          await takeMeasurements()
          // Make sure change in in/out tokens is always the same
          if(appDeltas['Alice'][inputToken.address].length >= 1) {
            expect(appDeltas['Alice'][inputToken.address][i]).to.equal(appDeltas['Bob'][inputToken.address][i])
            expect(appDeltas['Alice'][outputToken.address][i]).to.equal(appDeltas['Bob'][outputToken.address][i])
          }
        }

        await u.alice.flow({ flowRate: inflowRate2x, recipient: u.app });

        for(var j = 3; j <= 6; j++) {
          await traveler.advanceTimeAndBlock(60*60*1);
          await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
          await app.distribute()
          await takeMeasurements()
        }
      });

      // it("should distribute tokens to streamers correctly", async function() {
      //
      //   // // Check setup
      //   // expect(await app.isAppJailed()).to.equal(false)
      //   // expect(await app.getInputToken()).to.equal(inputToken.address)
      //   // expect(await app.getOutputToken()).to.equal(outputToken.address)
      //   // expect(await app.getOutputIndexId()).to.equal(0)
      //   // expect(await app.getSubsidyToken()).to.equal(ric.address)
      //   // expect(await app.getSubsidyIndexId()).to.equal(1)
      //   // expect(await app.getSubsidyRate()).to.equal("400000000000000000")
      //   // expect(await app.getTotalInflow()).to.equal(0)
      //   // // expect(await app.getLastDistributionAt()).to.equal()
      //   // expect(await app.getSushiRouter()).to.equal(ROUTER_ADDRESS)
      //   // expect(await app.getTellorOracle()).to.equal(TELLOR_ORACLE_ADDRESS)
      //   // expect(await app.getRequestId()).to.equal(TELLOR_REQUEST_ID)
      //   // expect(await app.getOwner()).to.equal(u.admin.address)
      //   // expect(await app.getFeeRate()).to.equal(20000)
      //   //
      //   // // Checks for unlimited approval
      //   // expect(await inputTokenUnderlying.allowance(app.address, ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
      //   // expect(await outputTokenUnderlying.allowance(app.address, ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
      //   // expect(await inputTokenUnderlying.allowance(app.address, inputToken.address)).to.be.equal(ethers.constants.MaxUint256);
      //   // expect(await outputTokenUnderlying.allowance(app.address, outputToken.address)).to.be.equal(ethers.constants.MaxUint256);
      //
      //   // await app.connect(owner).setFeeRate(20000);
      //   // await app.connect(owner).setRateTolerance(20000);
      //   // await app.connect(owner).setSubsidyRate("500000000000000000")
      //   //
      //   // expect(await app.getSubsidyRate()).to.equal("500000000000000000")
      //   // expect(await app.getFeeRate()).to.equal(20000)
      //   // expect(await app.getRateTolerance()).to.equal(20000)
      //   console.log("Getters and setters correct")
      //
      //   const inflowRate1 = "77160493827160"
      //   const inflowRate2 = "964506172839506"
      //   const inflowRate3 = "38580246913580"
      //   const inflowRateIDAShares1 = "77160"
      //   const inflowRateIDAShares2 = "964506"
      //   const inflowRateIDAShares3 = "38580"
      //
      //   await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
      //   await takeMeasurements();
      //
      //   // Test `closeStream`
      //   // Try close stream and expect revert
      //   // await expect(
      //   //  u.admin.flow({ flowRate: toWad(10000), recipient: u.app })
      //   // ).to.be.revertedWith("!enoughTokens");
      //
      //   // Test emergencyCloseStream
      //   // Connect Admin and Bob
      //  //  await u.bob.flow({ flowRate: inflowRate1, recipient: u.app });
      //  //  await traveler.advanceTimeAndBlock(60*60*12);
      //  //  await expect(
      //  //   app.emergencyDrain()
      //  // ).to.be.revertedWith("!zeroStreamers");
      //  // await u.bob.flow({ flowRate: "0", recipient: u.app });
      //  // await app.emergencyDrain();
      //  // expect((await inputToken.balanceOf(app.address)).toString()).to.equal("0");
      //  // expect((await outputToken.balanceOf(app.address)).toString()).to.equal("0");
      //  // await takeMeasurements(u);
      //
      //
      //   await u.alice.flow({ flowRate: inflowRate1, recipient: u.app });
      //   // Expect the parameters are correct
      //   expect(await app.getStreamRate(u.alice.address)).to.equal(inflowRate1);
      //   expect((await app.getIDAShares(0, u.alice.address)).toString()).to.equal("true,true,"+inflowRateIDAShares1+",0");
      //   expect((await app.getIDAShares(0, u.alice.address)).toString()).to.equal("true,true,"+inflowRateIDAShares1+",0");
      //   await traveler.advanceTimeAndBlock(60*60*12);
      //   await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
      //   await app.distribute()
      //   await takeMeasurements();
      //
      //   console.log("Distribution.")
      //   await traveler.advanceTimeAndBlock(60*60*1);
      //   await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
      //
      //
      //   // Connect Admin and Bob
      //   await u.bob.flow({ flowRate: inflowRate2, recipient: u.app });
      //   await takeMeasurements();
      //
      //   // Expect the parameters are correct
      //   expect(await app.getStreamRate(u.bob.address)).to.equal(inflowRate2);
      //   expect((await app.getIDAShares(0, u.bob.address)).toString()).to.equal("true,true,"+inflowRateIDAShares2+",0");
      //   expect((await app.getIDAShares(0, u.bob.address)).toString()).to.equal("true,true,"+inflowRateIDAShares2+",0");
      //   await traveler.advanceTimeAndBlock(60*60*2);
      //   await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
      //   await app.distribute()
      //   await takeMeasurements();
      //
      //   console.log("Distribution.")
      //
      //   // Connect Admin and Bob
      //   await u.alice.flow({ flowRate: inflowRate3, recipient: u.app });
      //   // Expect the parameters are correct
      //   expect(await app.getStreamRate(u.alice.address)).to.equal(inflowRate3);
      //   expect((await app.getIDAShares(0, u.alice.address)).toString()).to.equal("true,true,"+inflowRateIDAShares3+",0");
      //   expect((await app.getIDAShares(0, u.alice.address)).toString()).to.equal("true,true,"+inflowRateIDAShares3+",0");
      //   await traveler.advanceTimeAndBlock(60*60*4);
      //   await tp.submitValue(TELLOR_REQUEST_ID, oraclePrice);
      //   await app.distribute()
      //   console.log("Distribution.")
      //   await takeMeasurements();
      //
      //
      //
      //   // Try close stream and expect revert
      //   await expect(
      //    app.closeStream(u.bob.address)
      //   ).to.be.revertedWith("!closable");
      //
      //
      //   console.log(appBalances);
      //
      //
      //
      //
      // });

  });

});
