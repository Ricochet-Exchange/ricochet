const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");
const { expect } = require("chai");

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
    let daix;
    let usd;
    let usdcx;
    let tusd;
    let tusdx;
    let ric;
    let app;
    let tp; // Tellor playground
    let usingTellor;
    let sr; // Mock Sushi Router
    let ricAddress = "0xD856E023568c75B15ead234D482D0f41e21b6bA8";
    const u = {}; // object with all users
    const aliases = {};
    let owner;
    let alice;
    let bob;

    before(async function () {
        //process.env.RESET_SUPERFLUID_FRAMEWORK = 1;
        const [owner, alice, bob, carl] = await ethers.getSigners();
        await deployFramework(errorHandler, {
            web3,
            from: owner.address,
        });
    });

    beforeEach(async function () {
      // Admin
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be"]}
      )
      owner = await ethers.provider.getSigner("0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
      // Alice
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x88701a42AFc14cfd5d328AC4Db4daa18C7C43525"]}
      )
      alice = await ethers.provider.getSigner("0x88701a42AFc14cfd5d328AC4Db4daa18C7C43525")

      // Bob
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x60Ae2E5b6544455b5EFEd45FE4f831733d859873"]}
      )
      bob = await ethers.provider.getSigner("0x60Ae2E5b6544455b5EFEd45FE4f831733d859873")


        const [carl] = await ethers.getSigners();
        const accounts = [owner, alice, bob, carl] ;
        // await deployTestToken(errorHandler, [":", "fDAI"], {
        //     web3,
        //     from: owner.address,
        // });
        // await deployTestToken(errorHandler, [":", "ETH"], {
        //     web3,
        //     from: owner.address,
        // });
        // await deploySuperToken(errorHandler, [":", "fDAI"], {
        //     web3,
        //     from: owner.address,
        // });
        // await deploySuperToken(errorHandler, [":", "ETH"], {
        //     web3,
        //     from: owner.address,
        // });

        sf = new SuperfluidSDK.Framework({
            web3,
            resolverAddress: "0x659635Fab0A0cef1293f7eb3c7934542B6A6B31A",
            tokens: ["fDAI", "fUSDC", "fTUSD"],
        });
        await sf.initialize();
        usdcx = sf.tokens.fUSDCx;
        daix = sf.tokens.fDAIx;
        tusdx = sf.tokens.fTUSDx;
        usd = await sf.contracts.TestToken.at(await sf.tokens.fUSDC.address);
        dai = await sf.contracts.TestToken.at(await sf.tokens.fDAI.address);
        tusd = await sf.contracts.TestToken.at(await sf.tokens.fTUSD.address);
        // eth = await sf.contracts.TestToken.at(await sf.tokens.fETH.address);
        console.log(accounts[0]._address)
        for (var i = 0; i < names.length; i++) {
          console.log(accounts[i]._address)
            u[names[i].toLowerCase()] = sf.user({
                address: accounts[i]._address || accounts[i].address,
                token: usdcx.address,
            });
            u[names[i].toLowerCase()].alias = names[i];
            aliases[u[names[i].toLowerCase()].address] = names[i];
        }
        for (const [, user] of Object.entries(u)) {
            if (user.alias === "App") return;
            await web3tx(usd.mint, `${user.alias} mints many usd`)(
                user.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );
            await web3tx(dai.mint, `${user.alias} mints many dai`)(
                user.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );
            await web3tx(tusd.mint, `${user.alias} mints many tusd`)(
                user.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );
            await web3tx(usd.approve, `${user.alias} approves usdcx`)(
                usdcx.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );

            await web3tx(dai.approve, `${user.alias} approves daix`)(
                daix.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );

            await web3tx(tusd.approve, `${user.alias} approves tusdx`)(
                tusdx.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );
        }
        //u.zero = { address: ZERO_ADDRESS, alias: "0x0" };
        console.log("Admin:", u.admin.address);
        console.log("Host:", sf.host.address);
        console.log(sf.agreements.cfa.address);
        console.log(usdcx.address);

        // Deploy Tellor Oracle contracts
        const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
        tp = await TellorPlayground.deploy("Tellor oracle", "TRB");

        await tp.submitValue(1, 1050000);

        const UsingTellor = await ethers.getContractFactory("UsingTellor");
        usingTellor = await UsingTellor.deploy(tp.address);

        // Mocking Sushiswap Router
        const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
        sr = await MockUniswapRouter.deploy(tp.address, 1, dai.address);


        const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper");
        let sed = await StreamExchangeHelper.deploy();

        const StreamExchange = await ethers.getContractFactory("StreamExchange", {
          libraries: {
            StreamExchangeHelper: sed.address,
          },
        });

        const ERC20 = await ethers.getContractFactory("ERC20");
        ric = await ERC20.attach("0xD856E023568c75B15ead234D482D0f41e21b6bA8");
        // console.log("Get owner ric balance....");
        // console.log((await ric.balanceOf(u.admin.address)).toString())
        // console.log(await ric.getHost())
        ric = ric.connect(owner)


        app = await StreamExchange.deploy(sf.host.address,
                                          sf.agreements.cfa.address,
                                          sf.agreements.ida.address,
                                          usdcx.address,
                                          daix.address,
                                          ricAddress,
                                          "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", //sr.address,
                                          tp.address,
                                          1,"");
        console.log("Deployed")
        console.log(await ric.balanceOf(u.admin.address))
        await ric.transfer(app.address, "1000000000000000000000000")
        await app.transferOwnership(u.admin.address)

        console.log("App made")



        u.app = sf.user({ address: app.address, token: usdcx.address });
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
                .approveSubscription(daix.address, app.address, 0, "0x")
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
                .approveSubscription(daix.address, app.address, 0, "0x")
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
                .approveSubscription(daix.address, app.address, 0, "0x")
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
        console.log("DAIx: ", (await usdcx.balanceOf(user.address)).toString());
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
            await web3tx(
                tusdx.upgrade,
                `${accounts[i].alias} upgrades many TUSDx`
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
              .approveSubscription(usdcx.address, app.address, 0, "0x")
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
        expect(await app.getInputToken()).to.equal(usdcx.address)
        expect(await app.getOuputToken()).to.equal(daix.address)
        expect(await app.getOuputIndexId()).to.equal(0)
        expect(await app.getSubsidyToken()).to.equal(ric.address)
        expect(await app.getSubsidyIndexId()).to.equal(1)
        expect(await app.getSubsidyRate()).to.equal("400000000000000000")
        expect(await app.getTotalInflow()).to.equal(0)
        // expect(await app.getLastDistributionAt()).to.equal()
        expect(await app.getSushiRouter()).to.equal("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506")
        expect(await app.getTellorOracle()).to.equal(tp.address)
        expect(await app.getRequestId()).to.equal(1)
        expect(await app.getOwner()).to.equal(u.admin.address)
        expect(await app.getFeeRate()).to.equal(3000)

        await app.connect(owner).setFeeRate(200000);
        await app.connect(owner).setSubsidyRate("500000000000000000")

        expect(await app.getSubsidyRate()).to.equal("500000000000000000")
        expect(await app.getFeeRate()).to.equal(200000)

        console.log("Getters and setters correct")

        var appBalances = {usd: [], daix: [], ric: []}
        var aliceBalances = {usd: [], daix: [], ric: []}
        var bobBalances = {usd: [], daix: [], ric: []}

        const inflowRate = toWad(0.00004000);

        // Give the app a bit of each token to start
        await upgrade([u.alice, u.bob, u.admin, u.carl]);
        console.log("DAIx Address", u.admin.address)
        console.log("admin USDCx", (await usdcx.balanceOf(u.admin.address)).toString())
        await usdcx.transfer(app.address, toWad(0.0004000), {from: u.alice.address});
        console.log("admin DAIx", (await daix.balanceOf(u.admin.address)).toString())
        console.log("admin RIC", (await ric.balanceOf(u.admin.address)).toString())
        await ric.transfer(app.address, 1000);
        console.log("app balance", (await ric.balanceOf(app.address)).toString())
        // await daix.downgrade(toWad(5), {from: u.alice.address})
        // await eth.transfer(sr.address, toWad(5), {from: u.carl.address});

        // Take measurements
        appBalances.usd.push((await usdcx.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await usdcx.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await usdcx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        console.log("Bob bal eth", bobBalances)
        console.log("Alice bal eth", aliceBalances)
        console.log("App bal eth", appBalances)

        // Alice and Bob start streaming to the app+
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });

        // Go forward
        console.log("Go forward")
        await traveler.advanceTimeAndBlock(10 * TEST_TRAVEL_TIME);
        await tp.submitValue(1, 1050000);

        // Distribution - Everyone
        await app.distribute()

        // Take measurements
        appBalances.usd.push((await usdcx.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await usdcx.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await usdcx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        // Go forward
        await traveler.advanceTimeAndBlock(10 * TEST_TRAVEL_TIME);
        await tp.submitValue(1, 1050000);

        // Cancel Alice's flow
        await u.alice.flow({ flowRate: "0", recipient: u.app });
        // Distribution - Everyone
        // await app.distribute({from: u.admin.address})

        // Go forward
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME * 10);
        await tp.submitValue(1, 1050000);

        // Take measurements
        appBalances.usd.push((await usdcx.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await usdcx.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await usdcx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        // Distribution - Just Bob and Admin
        await app.distribute()

        // Take measurements
        appBalances.usd.push((await usdcx.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await usdcx.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await usdcx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        // Go forward
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME * 10);
        await tp.submitValue(1, 1050000);

        // Distribution, Restart Alice's flow
        // await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        // await web3tx(
        //     sf.host.callAgreement,
        //     "Alice approves subscription to the app"
        // )(
        //     sf.agreements.ida.address,
        //     sf.agreements.ida.contract.methods
        //         .approveSubscription(daix.address, app.address, 0, "0x")
        //         .encodeABI(),
        //     "0x", // user data
        //     {
        //         from: u.alice.address
        //     }
        // );
        // Distribution - Everyone
        await app.distribute()

        // Take measurements
        appBalances.usd.push((await usdcx.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await usdcx.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await usdcx.balanceOf(u.bob.address)).toString());

        appBalances.daix.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.daix.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.daix.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
        aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
        bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());

        // await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME * 10);
        // await tp.submitValue(1, 1050000);
        // // Distribution
        // await app.distribute({from: u.admin.address})
        //
        //
        // // Take measurements
        // appBalances.usd.push((await usdcx.balanceOf(u.admin.address)).toString());
        // aliceBalances.usd.push((await usdcx.balanceOf(u.alice.address)).toString());
        // bobBalances.usd.push((await usdcx.balanceOf(u.bob.address)).toString());
        //
        // appBalances.tusdx.push((await daix.balanceOf(u.admin.address)).toString());
        // aliceBalances.tusdx.push((await daix.balanceOf(u.alice.address)).toString());
        // bobBalances.tusdx.push((await daix.balanceOf(u.bob.address)).toString());
        //
        //
        console.log("Bob bal eth", bobBalances)
        console.log("Alice bal eth", aliceBalances)
        console.log("App bal eth", appBalances)


      });

  });

});
