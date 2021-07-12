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

    const names = ["Admin", "Alice", "Bob"];

    let sf;
    let dai;
    let ethx;
    let usd;
    let usdcx;
    let ric;
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
    const RIC_TOKEN_ADDRESS = "0x263026E7e53DBFDce5ae55Ade22493f828922965"
    const SUSHISWAP_ROUTER_ADDRESS = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
    const TELLOR_ORACLE_ADDRESS = "0xC79255821DA1edf8E1a8870ED5cED9099bf2eAAA"
    const TELLOR_REQUEST_ID = 1
    const BOB_ADDRESS = "0x00Ce20EC71942B41F50fF566287B811bbef46DC8"
    const ALICE_ADDRESS = "0x8c3bf3EB2639b2326fF937D041292dA2e79aDBbf"
    const OWNER_ADDRESS = "0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA"
    const SF_REG_KEY = process.env.SF_REG_KEY
    let oraclePrice;

    before(async function () {
        //process.env.RESET_SUPERFLUID_FRAMEWORK = 1;
        let response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        oraclePrice = parseInt(response.data.ethereum.usd * 1.005 * 1000000).toString()
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


        const accounts = [owner, alice, bob] ;


        sf = new SuperfluidSDK.Framework({
            web3,
            resolverAddress: "0xE0cc76334405EE8b39213E620587d815967af39C",
            tokens: ["DAI", "ETH"],
            version: "v1"
        });
        await sf.initialize();
        ethx = sf.tokens.ETHx;
        daix = sf.tokens.DAIx;

        for (var i = 0; i < names.length; i++) {
          console.log(accounts[i]._address)
            u[names[i].toLowerCase()] = sf.user({
                address: accounts[i]._address || accounts[i].address,
                token: daix.address,
            });
            u[names[i].toLowerCase()].alias = names[i];
            aliases[u[names[i].toLowerCase()].address] = names[i];
        }

        console.log("Owner:", u.admin.address);
        console.log("Host:", sf.host.address);
        console.log("DAIx: ",daix.address);
        console.log("ETHx: ",ethx.address);

        // NOTE: Assume the oracle is up to date
        // Deploy Tellor Oracle contracts
        const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
        tp = await TellorPlayground.attach(TELLOR_ORACLE_ADDRESS);
        //
        // await tp.submitValue(1, 1050000);

        // const UsingTellor = await ethers.getContractFactory("UsingTellor");
        // usingTellor = await UsingTellor.deploy(tp.address);

        // Mocking Sushiswap Router
        // const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
        // sr = await MockUniswapRouter.deploy(tp.address, 1, dai.address);

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
        ric = ric.connect(owner)

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
                                          daix.address,
                                          ethx.address,
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
        await web3tx(
            sf.host.callAgreement,
            "Alice approves subscription to the app"
        )(
            sf.agreements.ida.address,
            sf.agreements.ida.contract.methods
                .approveSubscription(ethx.address, app.address, 0, "0x")
                .encodeABI(),
            "0x", // user data
            {
                from: u.alice.address
            }
        );
        await web3tx(
            sf.host.callAgreement,
            "Bob approves subscription to the app"
        )(
            sf.agreements.ida.address,
            sf.agreements.ida.contract.methods
                .approveSubscription(ethx.address, app.address, 0, "0x")
                .encodeABI(),
            "0x", // user data
            {
                from: u.bob.address
            }
        );

        await web3tx(
            sf.host.callAgreement,
            "Admin approves subscription to the app"
        )(
            sf.agreements.ida.address,
            sf.agreements.ida.contract.methods
                .approveSubscription(ethx.address, app.address, 0, "0x")
                .encodeABI(),
            "0x", // user data
            {
                from: u.admin.address
            }
        );

        // Do approvals
        // Already approved?
        await web3tx(
            sf.host.callAgreement,
            "Alice approves subscription to the app"
        )(
            sf.agreements.ida.address,
            sf.agreements.ida.contract.methods
                .approveSubscription(ricAddress, app.address, 1, "0x")
                .encodeABI(),
            "0x", // user data
            {
                from: u.alice.address
            }
        );
        await web3tx(
            sf.host.callAgreement,
            "Bob approves subscription to the app"
        )(
            sf.agreements.ida.address,
            sf.agreements.ida.contract.methods
                .approveSubscription(ricAddress, app.address, 1, "0x")
                .encodeABI(),
            "0x", // user data
            {
                from: u.bob.address
            }
        );

        await web3tx(
            sf.host.callAgreement,
            "Admin approves subscription to the app"
        )(
            sf.agreements.ida.address,
            sf.agreements.ida.contract.methods
                .approveSubscription(ricAddress, app.address, 1, "0x")
                .encodeABI(),
            "0x", // user data
            {
                from: u.admin.address
            }
        );
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


    describe("Stream Exchange", async function () {
      this.timeout(100000);

      it("should distribute tokens to streamers correctly", async function() {

        // Check setup
        expect(await app.isAppJailed()).to.equal(false)
        expect(await app.getInputToken()).to.equal(daix.address)
        expect(await app.getOuputToken()).to.equal(ethx.address)
        expect(await app.getOuputIndexId()).to.equal(0)
        expect(await app.getSubsidyToken()).to.equal(ric.address)
        expect(await app.getSubsidyIndexId()).to.equal(1)
        expect(await app.getSubsidyRate()).to.equal("400000000000000000")
        expect(await app.getTotalInflow()).to.equal(0)
        // expect(await app.getLastDistributionAt()).to.equal()
        expect(await app.getSushiRouter()).to.equal(SUSHISWAP_ROUTER_ADDRESS)
        expect(await app.getTellorOracle()).to.equal(TELLOR_ORACLE_ADDRESS)
        expect(await app.getRequestId()).to.equal(1)
        expect(await app.getOwner()).to.equal(u.admin.address)
        expect(await app.getFeeRate()).to.equal(20000)

        await app.connect(owner).setFeeRate(20000);
        await app.connect(owner).setSubsidyRate("500000000000000000")

        expect(await app.getSubsidyRate()).to.equal("500000000000000000")
        expect(await app.getFeeRate()).to.equal(20000)
        console.log("Getters and setters correct")

        var appBalances = {ethx: [], daix: [], ric: []}
        var ownerBalances = {ethx: [], daix: [], ric: []}
        var aliceBalances = {ethx: [], daix: [], ric: []}
        var bobBalances = {ethx: [], daix: [], ric: []}

        const inflowRate = toWad(0.00004000);

        // Give the app a bit of each token to start
        // await upgrade([u.alice, u.bob, u.admin]);
        // console.log("DAIx Address", u.admin.address)
        // console.log("admin USDCx", (await usdcx.balanceOf(u.admin.address)).toString())
        // await ethx.transfer(u.bob.address, to, {from: u.alice.address});
        await daix.transfer(u.bob.address, "100000000000000000000", {from: u.alice.address});
        // console.log("admin DAIx", (await daix.balanceOf(u.admin.address)).toString())
        // console.log("admin RIC", (await ric.balanceOf(u.admin.address)).toString())
        // await ric.transfer(app.address, 1000);
        // console.log("app balance", (await ric.balanceOf(app.address)).toString())
        // await daix.downgrade(toWad(5), {from: u.alice.address})
        // await eth.transfer(sr.address, toWad(5), {from: u.carl.address});


        // Set oracle
        await tp.submitValue(1, oraclePrice);

        // Take measurements
        appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
        ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(app.address)).toString());
        ownerBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(app.address)).toString());
        ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        console.log("Bob bal eth", bobBalances)
        console.log("Alice bal eth", aliceBalances)
        console.log("App bal eth", appBalances)

        await checkBalances([u.admin, u.alice, u.bob])
        // Alice and Bob start streaming to the app+
        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });

        // Go forward
        console.log("Go forward a little bit")
        await traveler.advanceTimeAndBlock(60*60*3);
        await tp.submitValue(1, oraclePrice);

        // Distribution - Everyone
        await app.distribute()

        // Take measurements
        appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
        ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(app.address)).toString());
        ownerBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(app.address)).toString());
        ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        let bobDelta = bobBalances.ethx[1] - bobBalances.ethx[0]
        let aliceDelta = aliceBalances.ethx[1] - aliceBalances.ethx[0]
        let appDelta = appBalances.ethx[1] - appBalances.ethx[0]
        let ownerDelta = ownerBalances.ethx[1] - ownerBalances.ethx[0]

        console.log("Bob delta eth:", bobDelta)
        console.log("Alice delta eth:", aliceDelta)
        console.log("App delta eth:", appDelta)
        console.log("Fee rate", ownerDelta / (bobDelta + aliceDelta + ownerDelta))

        expect(bobBalances.ethx[1] - bobBalances.ethx[0]).to.equal(aliceBalances.ethx[1] - aliceBalances.ethx[0])
        expect(bobBalances.daix[1] - bobBalances.daix[0]).to.equal(aliceBalances.daix[1] - aliceBalances.daix[0])

        // // Go forward
        // console.log("Go forward a little bit")
        // await traveler.advanceTimeAndBlock(60*60*2);
        // await tp.submitValue(1, oraclePrice);
        //
        // // Distribution - Everyone
        // await app.distribute()
        //
        // // Take measurements
        // appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
        // ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
        // aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
        // bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());
        //
        // appBalances.daix.push((await daix.balanceOf(app.address)).toString());
        // ownerBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        // aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        // bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());
        //
        // appBalances.ric.push((await ric.balanceOf(app.address)).toString());
        // ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        // aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        // bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());
        //
        //
        // bobDelta = bobBalances.ethx[2] - bobBalances.ethx[1]
        // aliceDelta = aliceBalances.ethx[2] - aliceBalances.ethx[1]
        // appDelta = appBalances.ethx[2] - appBalances.ethx[1]
        // ownerDelta = ownerBalances.ethx[2] - ownerBalances.ethx[1]
        //
        // console.log("Bob delta eth:", bobDelta)
        // console.log("Alice delta eth:", aliceDelta)
        // console.log("App delta eth:", appDelta)
        // console.log("Owner delta eth:", ownerDelta)
        // console.log("Fee rate", ownerDelta / (bobDelta + aliceDelta + ownerDelta))
        //
        // // console.log("Bob bal eth", bobBalances)
        // // console.log("Alice bal eth", aliceBalances)
        // // console.log("App bal eth", appBalances)
        //
        // // Go forward
        // console.log("Go forward a little bit")
        // await traveler.advanceTimeAndBlock(60*60*3);
        // await tp.submitValue(1, oraclePrice);
        //
        // // Distribution - Everyone
        // await app.distribute()
        //
        // // Take measurements
        // appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
        // ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
        // aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
        // bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());
        //
        // appBalances.daix.push((await daix.balanceOf(app.address)).toString());
        // ownerBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        // aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        // bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());
        //
        // appBalances.ric.push((await ric.balanceOf(app.address)).toString());
        // ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        // aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        // bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());
        //
        //
        // bobDelta = bobBalances.ethx[3] - bobBalances.ethx[2]
        // aliceDelta = aliceBalances.ethx[3] - aliceBalances.ethx[2]
        // appDelta = appBalances.ethx[3] - appBalances.ethx[2]
        // ownerDelta = ownerBalances.ethx[3] - ownerBalances.ethx[2]
        //
        // console.log("Bob delta eth:", bobDelta)
        // console.log("Alice delta eth:", aliceDelta)
        // console.log("App delta eth:", appDelta)
        // console.log("Owner delta eth:", ownerDelta)
        // console.log("Fee rate", ownerDelta / (bobDelta + aliceDelta + ownerDelta))
        //
        // // Go forward
        // console.log("Go forward a little bit")
        // await traveler.advanceTimeAndBlock(60*60*3);
        // await tp.submitValue(1, oraclePrice);
        //
        // // Distribution - Everyone
        // await app.distribute()
        //
        // // Take measurements
        // appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
        // ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
        // aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
        // bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());
        //
        // appBalances.daix.push((await daix.balanceOf(app.address)).toString());
        // ownerBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        // aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        // bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());
        //
        // appBalances.ric.push((await ric.balanceOf(app.address)).toString());
        // ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        // aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        // bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());
        //
        // bobDelta = bobBalances.ethx[4] - bobBalances.ethx[3]
        // aliceDelta = aliceBalances.ethx[4] - aliceBalances.ethx[3]
        // appDelta = appBalances.ethx[4] - appBalances.ethx[3]
        // ownerDelta = ownerBalances.ethx[4] - ownerBalances.ethx[3]
        //
        // console.log("Bob delta eth:", bobDelta)
        // console.log("Alice delta eth:", aliceDelta)
        // console.log("App delta eth:", appDelta)
        // console.log("Owner delta eth:", ownerDelta)
        // console.log("Fee rate", ownerDelta / (bobDelta + aliceDelta + ownerDelta))
        //
        //
        //
        // // Go forward
        // console.log("Go forward a little bit")
        // await traveler.advanceTimeAndBlock(60*60*3);
        // await tp.submitValue(1, oraclePrice);
        //
        // // Distribution - Everyone
        // await app.distribute()
        //
        // // Take measurements
        // appBalances.ethx.push((await ethx.balanceOf(app.address)).toString());
        // ownerBalances.ethx.push((await ethx.balanceOf(u.admin.address)).toString());
        // aliceBalances.ethx.push((await ethx.balanceOf(u.alice.address)).toString());
        // bobBalances.ethx.push((await ethx.balanceOf(u.bob.address)).toString());
        //
        // appBalances.daix.push((await daix.balanceOf(app.address)).toString());
        // ownerBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        // aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        // bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());
        //
        // appBalances.ric.push((await ric.balanceOf(app.address)).toString());
        // ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        // aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        // bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());
        //
        // bobDelta = bobBalances.ethx[5] - bobBalances.ethx[4]
        // aliceDelta = aliceBalances.ethx[5] - aliceBalances.ethx[4]
        // appDelta = appBalances.ethx[5] - appBalances.ethx[4]
        // ownerDelta = ownerBalances.ethx[5] - ownerBalances.ethx[4]
        //
        // console.log("Bob delta eth:", bobDelta)
        // console.log("Alice delta eth:", aliceDelta)
        // console.log("App delta eth:", appDelta)
        // console.log("Owner delta eth:", ownerDelta)
        // console.log("Fee rate", ownerDelta / (bobDelta + aliceDelta + ownerDelta))
        //
        //
        //
        // console.log("Bob bal eth", bobBalances)
        // console.log("Alice bal eth", aliceBalances)
        // console.log("App bal eth", appBalances)
        // console.log("Owner bal eth", ownerBalances)
        //
        // let bobDeltaEth = bobBalances.ethx[5] - bobBalances.ethx[0]
        // let aliceDeltaEth = aliceBalances.ethx[5] - aliceBalances.ethx[0]
        //
        // let bobDeltaDai = bobBalances.daix[0] - bobBalances.daix[5]
        // let aliceDeltaDai = aliceBalances.daix[0] - aliceBalances.daix[5]
        // console.log("Alice Delta Eth", aliceDeltaEth)
        // console.log("Bob Delta Eth", bobDeltaEth)
        // console.log("Alice Delta Dai", aliceDeltaDai)
        // console.log("Bob Delta Dai", bobDeltaDai)
        //
        // console.log("ExchangeRateBob", bobDeltaDai/bobDeltaEth)
        // console.log("ExchangeRateAlice", aliceDeltaDai/aliceDeltaEth)
        // console.log(bobDelta * oraclePrice / 1e6, bobBalances.daix[0])



      });

  });

});
