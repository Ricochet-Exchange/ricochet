const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");
const { expect } = require("chai");
const axios = require('axios').default;
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const SuperfluidSDK = require("@superfluid-finance/js-sdk");
const traveler = require("ganache-time-traveler");

// Prerequesites
// 1. Setup Alice, Bob, and Carl with some inputTokens and NO outputTokens
// 2. Owner needs some MATIC to deploy and show hold NO outputTokens

const RIC_TOKEN_ADDRESS = process.env.RIC_TO
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS
const TELLOR_ORACLE_ADDRESS = process.env.TELLOR_ORACLE_ADDRESS
const TELLOR_REQUEST_ID = process.env.TELLOR_REQUEST_ID
const SF_REG_KEY = process.env.SF_REG_KEY

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
    let outputToken; // MKR
    let appBalances = {};

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
        let response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=wrapped-bitcoin&vs_currencies=usd')
        oraclePrice = parseInt(response.data["wrapped-bitcoin"].usd * 1.02 * 1000000).toString()
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
      const accounts = [owner, alice, bob, carl];

      // Setup users and setup to track user balances
      for (var i = 0; i < names.length; i++) {

          u[names[i].toLowerCase()] = sf.user({
              address: accounts[i]._address || accounts[i].address,
              token: inputToken.address
          });

          u[names[i].toLowerCase()].alias = names[i];
          aliases[u[names[i].toLowerCase()].address] = names[i];

          appBalances[names[i]] = {};
          appBalances[names[i]][inputToken] = [];
          appBalances[names[i]][outputToken] = [];
      }

      // Setup contract connections
      const SuperToken = await ethers.getContractFactory("SuperToken");
      inputToken = await SuperToken.attach(inputTokenAddress);
      outputToken = await SuperToken.attach(outputTokenAddress);
      ric = await SuperToken.attach(RIC_TOKEN_ADDRESS);
      ric = ric.connect(owner)
      tp = tp.connect(owner)

      console.log("Owner:", u.admin.address);
      console.log("Host:", sf.host.address);
      console.log("Input Token: ", inputToken.address);
      console.log("Output Token: ", outputToken.address);

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
      let tokens = [out.address, ric.address]
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


    async function takeMeasurements(accounts) {

      for (let i = 0; i < accounts.length; ++i) {
        appBalances[names[i]][inputToken].push((await ethx.balanceOf(inputToken.address)).toString())
        appBalances[names[i]][ouputToken].push((await ethx.balanceOf(inputToken.address)).toString())
      }
    }


    describe("Stream Exchange", async function () {
      this.timeout(1000000);

      it("should distribute tokens to streamers correctly", async function() {

        // Check setup
        expect(await app.isAppJailed()).to.equal(false)
        expect(await app.getInputToken()).to.equal(inputToken.address)
        expect(await app.getOuputToken()).to.equal(ouputToken.address)
        expect(await app.getOuputIndexId()).to.equal(0)
        expect(await app.getSubsidyToken()).to.equal(ric.address)
        expect(await app.getSubsidyIndexId()).to.equal(1)
        expect(await app.getSubsidyRate()).to.equal("400000000000000000")
        expect(await app.getTotalInflow()).to.equal(0)
        // expect(await app.getLastDistributionAt()).to.equal()
        expect(await app.getSushiRouter()).to.equal(ROUTER_ADDRESS)
        expect(await app.getTellorOracle()).to.equal(TELLOR_ORACLE_ADDRESS)
        expect(await app.getRequestId()).to.equal(TELLOR_REQUEST_ID)
        expect(await app.getOwner()).to.equal(u.admin.address)
        expect(await app.getFeeRate()).to.equal(20000)

        // Checks for unlimited approval
        expect(await wbtc.allowance(app.address, ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
        expect(await usdc.allowance(app.address, ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
        expect(await wbtc.allowance(app.address, inputToken.address)).to.be.equal(ethers.constants.MaxUint256);
        expect(await usdc.allowance(app.address, outputToken.address)).to.be.equal(ethers.constants.MaxUint256);

        await app.connect(owner).setFeeRate(20000);
        await app.connect(owner).setRateTolerance(20000);
        await app.connect(owner).setSubsidyRate("500000000000000000")

        expect(await app.getSubsidyRate()).to.equal("500000000000000000")
        expect(await app.getFeeRate()).to.equal(20000)
        expect(await app.getRateTolerance()).to.equal(20000)
        console.log("Getters and setters correct")

        const inflowRate1 = "77160493827160"
        const inflowRate2 = "964506172839506"
        const inflowRate3 = "38580246913580"
        const inflowRateIDAShares1 = "77160"
        const inflowRateIDAShares2 = "964506"
        const inflowRateIDAShares3 = "38580"

        console.log("Transfer bob")
        await inputToken.transfer(u.bob.address, toWad(400), {from: u.carl.address});
        console.log("Transfer aliuce")
        await inputToken.transfer(u.alice.address, toWad(400), {from: u.carl.address});
        console.log("Done")

        await tp.submitValue(60, oraclePrice);

        await takeMeasurements();

        // Test `closeStream`
        // Try close stream and expect revert
        await expect(
         u.admin.flow({ flowRate: toWad(10000), recipient: u.app })
        ).to.be.revertedWith("!enoughTokens");

        // Test emergencyCloseStream
        // Connect Admin and Bob
        await u.bob.flow({ flowRate: inflowRate1, recipient: u.app });
        await traveler.advanceTimeAndBlock(60*60*12);
        await expect(
         app.emergencyDrain()
       ).to.be.revertedWith("!zeroStreamers");
       await u.bob.flow({ flowRate: "0", recipient: u.app });
       await app.emergencyDrain();
       expect((await inputToken.balanceOf(app.address)).toString()).to.equal("0");
       expect((await outputToken.balanceOf(app.address)).toString()).to.equal("0");


        await u.admin.flow({ flowRate: inflowRate1, recipient: u.app });
        // Expect the parameters are correct
        expect(await app.getStreamRate(u.admin.address)).to.equal(inflowRate1);
        expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal("true,true,"+inflowRateIDAShares1+",0");
        expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal("true,true,"+inflowRateIDAShares1+",0");
        await traveler.advanceTimeAndBlock(60*60*12);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        console.log("Distribution.")
        await traveler.advanceTimeAndBlock(60*60*1);
        await tp.submitValue(60, oraclePrice);


        // Connect Admin and Bob
        await u.admin.flow({ flowRate: inflowRate2, recipient: u.app });
        // Expect the parameters are correct
        expect(await app.getStreamRate(u.admin.address)).to.equal(inflowRate2);
        expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal("true,true,"+inflowRateIDAShares2+",0");
        expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal("true,true,"+inflowRateIDAShares2+",0");
        await traveler.advanceTimeAndBlock(60*60*2);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        console.log("Distribution.")

        // Connect Admin and Bob
        await u.admin.flow({ flowRate: inflowRate3, recipient: u.app });
        // Expect the parameters are correct
        expect(await app.getStreamRate(u.admin.address)).to.equal(inflowRate3);
        expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal("true,true,"+inflowRateIDAShares3+",0");
        expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal("true,true,"+inflowRateIDAShares3+",0");
        await traveler.advanceTimeAndBlock(60*60*4);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        console.log("Distribution.")


        // Try close stream and expect revert
        await expect(
         app.closeStream(u.bob.address)
        ).to.be.revertedWith("!closable");






      });

  });

});
