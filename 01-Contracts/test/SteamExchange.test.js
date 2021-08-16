const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");
const { expect } = require("chai");
const axios = require('axios').default;
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const SuperfluidSDK = require("@superfluid-finance/js-sdk");

const traveler = require("ganache-time-traveler");
const TEST_TRAVEL_TIME = 3600 * 2; // 1 hours

describe("StreamExchange", () => {
    const errorHandler = (err) => {
        if (err) throw err;
    };

    const names = ["Admin", "Alice", "Bob", "Carl"];

    let sf;
    let dai;
    let ethx;
    let wbtc;
    let wbtcx;
    let usd;
    let usdcx;
    let ric;
    let usdc;
    let eth;
    let app;
    let tp; // Tellor playground
    let usingTellor;
    let sr; // Mock Sushi Router
    let ricAddress = "0x263026e7e53dbfdce5ae55ade22493f828922965";
    const u = {}; // object with all users
    const aliases = {};
    let owner;
    let alice;
    let bob;
    let carl;
    const RIC_TOKEN_ADDRESS = "0x263026E7e53DBFDce5ae55Ade22493f828922965"
    const SUSHISWAP_ROUTER_ADDRESS = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
    const TELLOR_ORACLE_ADDRESS = "0xACC2d27400029904919ea54fFc0b18Bf07C57875"
    const TELLOR_REQUEST_ID = 60
    const CARL_ADDRESS = "0x8c3bf3EB2639b2326fF937D041292dA2e79aDBbf"
    const BOB_ADDRESS = "0x00Ce20EC71942B41F50fF566287B811bbef46DC8"
    const ALICE_ADDRESS = "0x9f348cdD00dcD61EE7917695D2157ef6af2d7b9B"
    const OWNER_ADDRESS = "0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA"
    const SF_REG_KEY = process.env.SF_REG_KEY
    let oraclePrice;

    var appBalances = {ethx: [], wbtcx: [], daix: [], usdcx: [], ric: []}
    var ownerBalances = {ethx: [], wbtcx: [], daix: [], usdcx: [], ric: []}
    var aliceBalances = {ethx: [], wbtcx: [], daix: [], usdcx: [], ric: []}
    var bobBalances = {ethx: [], wbtcx: [], daix: [], usdcx: [], ric: []}

    before(async function () {
        //process.env.RESET_SUPERFLUID_FRAMEWORK = 1;
        let response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=wrapped-bitcoin&vs_currencies=usd')
        oraclePrice = parseInt(response.data["wrapped-bitcoin"].usd * 1.02 * 1000000).toString()
        console.log("oraclePrice", oraclePrice)
    });

    beforeEach(async function () {
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


        const accounts = [owner, alice, bob, carl] ;


        sf = new SuperfluidSDK.Framework({
            web3,
            resolverAddress: "0xE0cc76334405EE8b39213E620587d815967af39C",
            tokens: ["WBTC", "DAI", "USDC", "ETH"],
            version: "v1"
        });
        await sf.initialize();
        ethx = sf.tokens.ETHx;
        wbtcx = sf.tokens.WBTCx;
        daix = sf.tokens.DAIx;
        usdcx = sf.tokens.USDCx;

        for (var i = 0; i < names.length; i++) {
          console.log(accounts[i]._address)
            u[names[i].toLowerCase()] = sf.user({
                address: accounts[i]._address || accounts[i].address,
                token: usdcx.address,
            });
            u[names[i].toLowerCase()].alias = names[i];
            aliases[u[names[i].toLowerCase()].address] = names[i];
        }

        console.log("Owner:", u.admin.address);
        console.log("Host:", sf.host.address);
        console.log("DAIx: ", daix.address);
        console.log("USDCx: ", usdcx.address);
        console.log("ETHx: ", ethx.address);

        // NOTE: Assume the oracle is up to date
        // Deploy Tellor Oracle contracts
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

        const ERC20 = await ethers.getContractFactory("ERC20");
        ric = await ERC20.attach(RIC_TOKEN_ADDRESS);
        weth = await ERC20.attach(await ethx.getUnderlyingToken());
        wbtc = await ERC20.attach(await wbtcx.getUnderlyingToken());
        usdc = await ERC20.attach(await usdcx.getUnderlyingToken());
        ric = ric.connect(owner)
        tp = tp.connect(owner)

        // NOTE: To attach to existing SE
        // let se = await StreamExchange.attach(STREAM_EXCHANGE_ADDRESS);

        console.log("Deploy params:")
        console.log("SF HOST", sf.host.address)
        console.log("SF CFA", sf.agreements.cfa.address)
        console.log("SF IDA", sf.agreements.ida.address)
        console.log("DAIx", daix.address)
        console.log("ETHx", ethx.address)
        app = await StreamExchange.deploy(sf.host.address,
                                          sf.agreements.cfa.address,
                                          sf.agreements.ida.address,
                                          usdcx.address,
                                          wbtcx.address,
                                          RIC_TOKEN_ADDRESS,
                                          SUSHISWAP_ROUTER_ADDRESS, //sr.address,
                                          TELLOR_ORACLE_ADDRESS,
                                          TELLOR_REQUEST_ID,
                                          SF_REG_KEY);
        console.log("Deployed")
        console.log(await ric.balanceOf(u.admin.address))
        // await ric.transfer(app.address, "1000000000000000000000000")

        u.app = sf.user({ address: app.address, token: daix.address });
        u.app.alias = "App";
        await checkBalance(u.app);

        // Do approvals
        // Already approved?

        let tokens = [wbtcx.address, ricAddress]
        let users = [u.alice.address, u.bob.address, u.admin.address]

        for (let t = 0; t < tokens.length; t++) {
          for (let u = 0; u < users.length; u++) {
            let index = 0
            if (tokens[t] == ricAddress) {
              index = 1
            }

            await web3tx(
                sf.host.callAgreement,
                users[u] + " approves subscription to the app"
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
        console.log("DAIx: ", (await daix.balanceOf(user.address)).toString());
        console.log("ETHx: ", (await ethx.balanceOf(user.address)).toString());
    }

    async function checkBalances(accounts) {
        for (let i = 0; i < accounts.length; ++i) {
            await checkBalance(accounts[i]);
        }
    }

    async function upgrade(accounts) {
        for (let i = 0; i < accounts.length; ++i) {
            await web3tx(
                usdcx.upgrade,
                `${accounts[i].alias} upgrades many USDCx`
            )(toWad(100000000), { from: accounts[i].address });
            await web3tx(
                daix.upgrade,
                `${accounts[i].alias} upgrades many DAIx`
            )(toWad(100000000), { from: accounts[i].address });


            await checkBalance(accounts[i]);
        }
    }

    async function logUsers() {
        let string = "user\t\ttokens\t\tnetflow\n";
        let p = 0;
        for (const [, user] of Object.entries(u)) {
            if (await hasFlows(user)) {
                p++;
                string += `${user.alias}\t\t${wad4human(
                    await usdcx.balanceOf(user.address)
                )}\t\t${wad4human((await user.details()).cfa.netFlow)}
            `;
            }
        }
        if (p == 0) return console.warn("no users with flows");
        console.log("User logs:");
        console.log(string);
    }

    async function hasFlows(user) {
        const { inFlows, outFlows } = (await user.details()).cfa.flows;
        return inFlows.length + outFlows.length > 0;
    }

    async function appStatus() {
        const isApp = await sf.host.isApp(u.app.address);
        const isJailed = await sf.host.isAppJailed(app.address);
        !isApp && console.error("App is not an App");
        isJailed && console.error("app is Jailed");
        await checkBalance(u.app);
        await checkOwner();
    }

    async function checkOwner() {
        const owner = await u.admin.address;
        console.log("Contract Owner: ", aliases[owner], " = ", owner);
        return owner.toString();
    }

    async function subscribe(user) {
      // Alice approves a subscription to the app
      console.log(sf.host.callAgreement)
      console.log(sf.agreements.ida.address)
      console.log(usdcx.address)
      console.log(app.address)
      await web3tx(
          sf.host.callAgreement,
          "user approves subscription to the app"
      )(
          sf.agreements.ida.address,
          sf.agreements.ida.contract.methods
              .approveSubscription(ethx.address, app.address, 0, "0x")
              .encodeABI(),
          "0x", // user data
          {
              from: user
          }
      );


    }

    async function delta(account, balances) {
      let len = balances.wbtcx.length
      let changeInInToken = balances.wbtcx[len-1] - balances.wbtcx[len-2]
      let changeInOutToken = balances.usdcx[len-1] - balances.usdcx[len-2]
      console.log()
      console.log("Change in balances for ", account)
      console.log("Wbtcx:", changeInInToken, "Bal:", balances.wbtcx[len-1])
      console.log("Usdcx:", changeInOutToken, "Bal:", balances.usdcx[len-1])
      console.log("Exchange Rate:", changeInOutToken/changeInInToken)
    }

    async function takeMeasurements() {
      appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
      ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
      aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
      bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());

      appBalances.wbtcx.push((await wbtcx.balanceOf(app.address)).toString());
      ownerBalances.wbtcx.push((await wbtcx.balanceOf(u.admin.address)).toString());
      aliceBalances.wbtcx.push((await wbtcx.balanceOf(u.alice.address)).toString());
      bobBalances.wbtcx.push((await wbtcx.balanceOf(u.bob.address)).toString());

      appBalances.usdcx.push((await usdcx.balanceOf(app.address)).toString());
      ownerBalances.usdcx.push((await usdcx.balanceOf(u.admin.address)).toString());
      aliceBalances.usdcx.push((await usdcx.balanceOf(u.alice.address)).toString());
      bobBalances.usdcx.push((await usdcx.balanceOf(u.bob.address)).toString());

      appBalances.ric.push((await ric.balanceOf(app.address)).toString());
      ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
      aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
      bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());
    }


    describe("Stream Exchange", async function () {
      this.timeout(100000);

      it("should distribute tokens to streamers correctly", async function() {

        // Check setup
        expect(await app.isAppJailed()).to.equal(false)
        expect(await app.getInputToken()).to.equal(usdcx.address)
        expect(await app.getOuputToken()).to.equal(wbtcx.address)
        expect(await app.getOuputIndexId()).to.equal(0)
        expect(await app.getSubsidyToken()).to.equal(ric.address)
        expect(await app.getSubsidyIndexId()).to.equal(1)
        expect(await app.getSubsidyRate()).to.equal("400000000000000000")
        expect(await app.getTotalInflow()).to.equal(0)
        // expect(await app.getLastDistributionAt()).to.equal()
        expect(await app.getSushiRouter()).to.equal(SUSHISWAP_ROUTER_ADDRESS)
        expect(await app.getTellorOracle()).to.equal(TELLOR_ORACLE_ADDRESS)
        expect(await app.getRequestId()).to.equal(60)
        expect(await app.getOwner()).to.equal(u.admin.address)
        expect(await app.getFeeRate()).to.equal(20000)

        // Checks for unlimited approval
        expect(await wbtc.allowance(app.address, SUSHISWAP_ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
        expect(await usdc.allowance(app.address, SUSHISWAP_ROUTER_ADDRESS)).to.be.equal(ethers.constants.MaxUint256);
        expect(await wbtc.allowance(app.address, wbtcx.address)).to.be.equal(ethers.constants.MaxUint256);
        expect(await usdc.allowance(app.address, usdcx.address)).to.be.equal(ethers.constants.MaxUint256);

        await app.connect(owner).setFeeRate(20000);
        await app.connect(owner).setRateTolerance(50000);
        await app.connect(owner).setSubsidyRate("500000000000000000")

        expect(await app.getSubsidyRate()).to.equal("500000000000000000")
        expect(await app.getFeeRate()).to.equal(20000)
        expect(await app.getRateTolerance()).to.equal(50000)
        console.log("Getters and setters correct")

        const inflowRateDecimal = 0.001
        const inflowRate = toWad(inflowRateDecimal);

        console.log("Transfer bob")
        await usdcx.transfer(u.bob.address, toWad(400), {from: u.carl.address});
        console.log("Transfer aliuce")
        await usdcx.transfer(u.alice.address, toWad(400), {from: u.carl.address});
        console.log("Done")

        await tp.submitValue(60, oraclePrice);

        await takeMeasurements();

        // Test owner start/stop stream
        // Try close stream and expect revert
        await expect(
         u.admin.flow({ flowRate: toWad(10000), recipient: u.app })
       ).to.be.revertedWith("!enoughTokens");
        await u.admin.flow({ flowRate: inflowRate, recipient: u.app });
        await traveler.advanceTimeAndBlock(60*60*1);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        await u.admin.flow({ flowRate: "0", recipient: u.app });



        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });
        await traveler.advanceTimeAndBlock(60*60*1);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        await takeMeasurements();
        await delta("Bob", bobBalances)
        await delta("Alice", aliceBalances)
        await delta("Owner", ownerBalances)

        // Round 2
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        await traveler.advanceTimeAndBlock(60*60*1);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        await takeMeasurements()
        await delta("Bob", bobBalances)
        await delta("Alice", aliceBalances)
        await delta("Owner", ownerBalances)


        // Round 3
        await traveler.advanceTimeAndBlock(60*60*1);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        await takeMeasurements()
        await delta("Bob", bobBalances)
        await delta("Alice", aliceBalances)
        await delta("Owner", ownerBalances)

        // Try close stream and expect revert
        await expect(
         app.closeStream(u.bob.address)
        ).to.be.revertedWith("!closable");

        // Round 4
        // await u.alice.flow({ flowRate: "0", recipient: u.app });
        while((await usdcx.balanceOf(u.bob.address)) > inflowRateDecimal * 60 * 60 * 8 * 1e18 ) {
          await traveler.advanceTimeAndBlock(60*60*1);
          await tp.submitValue(60, oraclePrice);
          await app.distribute()
          await takeMeasurements()
          await delta("Bob", bobBalances)
          await delta("Alice", aliceBalances)
          await delta("Owner", ownerBalances)
        }

        // Try to close bobs stream
        await app.closeStream(u.bob.address);
        // Verify its closed and cleaned up
        expect(await app.getStreamRate(u.bob.address)).to.equal("0")
        expect((await app.getIDAShares(0, u.bob.address)).toString()).to.equal("true,true,0,0")
        expect((await app.getIDAShares(1, u.bob.address)).toString()).to.equal("true,true,0,0")


        // Round 5 - Run them empty and close with keeper
        await traveler.advanceTimeAndBlock(60*60*1);
        await tp.submitValue(60, oraclePrice);
        await app.distribute()
        await takeMeasurements()
        await delta("Bob", bobBalances)
        await delta("Alice", aliceBalances)
        await delta("Owner", ownerBalances)



      });

  });

});
