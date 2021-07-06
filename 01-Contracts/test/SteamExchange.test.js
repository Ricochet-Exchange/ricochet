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
    let ricx;
    let app;
    let tp; // Tellor playground
    let usingTellor;
    let sr; // Mock Sushi Router
    const u = {}; // object with all users
    const aliases = {};

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
      const owner = await ethers.provider.getSigner("0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
      // Alice
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x88701a42AFc14cfd5d328AC4Db4daa18C7C43525"]}
      )
      const alice = await ethers.provider.getSigner("0x88701a42AFc14cfd5d328AC4Db4daa18C7C43525")

      // Bob
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x60Ae2E5b6544455b5EFEd45FE4f831733d859873"]}
      )
      const bob = await ethers.provider.getSigner("0x60Ae2E5b6544455b5EFEd45FE4f831733d859873")


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
            tokens: ["fDAI", "fUSDC", "ETHx"],
        });
        await sf.initialize();
        daix = sf.tokens.fUSDCx;
        ethx = sf.tokens.fDAIx;
        dai = await sf.contracts.TestToken.at(await sf.tokens.fUSDC.address);
        eth = await sf.contracts.TestToken.at(await sf.tokens.fDAI.address);
        console.log(accounts[0]._address)
        for (var i = 0; i < names.length; i++) {
          console.log(accounts[i]._address)
            u[names[i].toLowerCase()] = sf.user({
                address: accounts[i]._address || accounts[i].address,
                token: daix.address,
            });
            u[names[i].toLowerCase()].alias = names[i];
            aliases[u[names[i].toLowerCase()].address] = names[i];
        }
        for (const [, user] of Object.entries(u)) {
            if (user.alias === "App") return;
            await web3tx(dai.mint, `${user.alias} mints many dai`)(
                user.address,
                toWad(100000000),
                {
                    from: user.address,
                }
            );
            await web3tx(eth.mint, `${user.alias} mints many eth`)(
                user.address,
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

            await web3tx(eth.approve, `${user.alias} approves ethx`)(
                ethx.address,
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
        console.log(daix.address);

        // Deploy Tellor Oracle contracts
        const TellorPlayground = await ethers.getContractFactory("TellorPlayground");
        tp = await TellorPlayground.deploy("Tellor oracle", "TRB");

        await tp.submitValue(1, 1010000);

        const UsingTellor = await ethers.getContractFactory("UsingTellor");
        usingTellor = await UsingTellor.deploy(tp.address);

        // Mocking Sushiswap Router
        const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
        sr = await MockUniswapRouter.deploy(tp.address, 1, eth.address);


        const StreamExchangeHelper = await ethers.getContractFactory("StreamExchangeHelper");
        let sed = await StreamExchangeHelper.deploy();

        const StreamExchange = await ethers.getContractFactory("StreamExchange", {
          libraries: {
            StreamExchangeHelper: sed.address,
          },
        });


        // Deploy Super Ricochet
        const Ricochet = await ethers.getContractFactory("Ricochet");
        let ric = await Ricochet.deploy(u.admin.address);
        let r = (await ric.totalSupply()).toString();
        console.log("total supply", r);

        const SuperRicochet = await ethers.getContractFactory("SuperRicochet");
        let superRic = await SuperRicochet.deploy(sf.host.address);

        await superRic.createSuperToken(ric.address);
        let superRicAddress = await superRic.getSuperToken(ric.address);

        console.log("Ricochet:", ric.address)
        console.log("SuperRicochet:", superRicAddress)

        const SuperToken = await ethers.getContractFactory("SuperToken");
        ricx = await SuperToken.attach(superRicAddress);


        app = await StreamExchange.deploy(sf.host.address,
                                          sf.agreements.cfa.address,
                                          sf.agreements.ida.address,
                                          daix.address,
                                          ethx.address,
                                          superRicAddress,
                                          "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", //sr.address,
                                          tp.address,
                                          1,"");
        await app.transferOwnership(u.admin.address)
        console.log("Upgrading")
        console.log((await ric.balanceOf(u.admin.address)).toString())
        await ric.approve(ricx.address, '10000000000000000000000000');
        console.log("upgrading")
        console.log((await ric.allowance(u.admin.address, ricx.address)).toString())
        await ricx.upgrade('100000000000000000000000');
        console.log("Get owner ric balance....");
        console.log("Transfer")
        await ricx.transfer(app.address, "100000000000000000000000");

        app = app.connect(owner)
        console.log("App made")



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
    });

    async function checkBalance(user) {
        console.log("Balance of ", user.alias);
        console.log("DAIx: ", (await daix.balanceOf(user.address)).toString());
    }

    async function checkBalances(accounts) {
        for (let i = 0; i < accounts.length; ++i) {
            await checkBalance(accounts[i]);
        }
    }

    async function upgrade(accounts) {
        for (let i = 0; i < accounts.length; ++i) {
            await web3tx(
                daix.upgrade,
                `${accounts[i].alias} upgrades many DAIx`
            )(toWad(100000000), { from: accounts[i].address });
            await web3tx(
                ethx.upgrade,
                `${accounts[i].alias} upgrades many ETHx`
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
                    await daix.balanceOf(user.address)
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
      console.log(daix.address)
      console.log(app.address)
      await web3tx(
          sf.host.callAgreement,
          "user approves subscription to the app"
      )(
          sf.agreements.ida.address,
          sf.agreements.ida.contract.methods
              .approveSubscription(daix.address, app.address, 0, "0x")
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

        var appBalances = {usd: [], eth: [], ricx: []}
        var aliceBalances = {usd: [], eth: [], ricx: []}
        var bobBalances = {usd: [], eth: [], ricx: []}

        const inflowRate = toWad(0.00004000);

        // Give the app a bit of each token to start
        // await upgrade([u.alice, u.bob, u.admin, u.carl]);
        console.log("DAIx Address", u.admin.address)
        console.log("admin USDCx", (await daix.balanceOf(u.admin.address)).toString())
        await daix.transfer(app.address, toWad(0.0004000), {from: u.alice.address});
        console.log("admin DAIx", (await ethx.balanceOf(u.admin.address)).toString())
        await ethx.transfer(app.address, toWad(0.0004000), {from: u.alice.address});
        // await ethx.downgrade(toWad(5), {from: u.alice.address})
        // await eth.transfer(sr.address, toWad(5), {from: u.carl.address});

        // Take measurements
        appBalances.usd.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.eth.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.eth.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.eth.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.ricx.push((await ricx.balanceOf(u.admin.address)).toString());
        aliceBalances.ricx.push((await ricx.balanceOf(u.alice.address)).toString());
        bobBalances.ricx.push((await ricx.balanceOf(u.bob.address)).toString());

        console.log("Bob bal eth", bobBalances)
        console.log("Alice bal eth", aliceBalances)
        console.log("App bal eth", appBalances)

        // Alice and Bob start streaming to the app+
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });

        // Go forward
        console.log("Go forward")
        await traveler.advanceTimeAndBlock(10 * TEST_TRAVEL_TIME);
        await tp.submitValue(1, 1010000);

        // Distribution - Everyone
        await app.distribute({from: u.admin.address})

        // Take measurements
        appBalances.usd.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.eth.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.eth.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.eth.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.ricx.push((await ricx.balanceOf(u.admin.address)).toString());
        aliceBalances.ricx.push((await ricx.balanceOf(u.alice.address)).toString());
        bobBalances.ricx.push((await ricx.balanceOf(u.bob.address)).toString());

        // Go forward
        await traveler.advanceTimeAndBlock(10 * TEST_TRAVEL_TIME);
        await tp.submitValue(1, 1010000);

        // Cancel Alice's flow
        await u.alice.flow({ flowRate: "0", recipient: u.app });
        // Distribution - Everyone
        // await app.distribute({from: u.admin.address})


        // Take measurements
        appBalances.usd.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.eth.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.eth.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.eth.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.ricx.push((await ricx.balanceOf(u.admin.address)).toString());
        aliceBalances.ricx.push((await ricx.balanceOf(u.alice.address)).toString());
        bobBalances.ricx.push((await ricx.balanceOf(u.bob.address)).toString());

        // Go forward
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME * 10);
        await tp.submitValue(1, 1010000);

        // Distribution - Just Bob and Admin
        await app.distribute({from: u.admin.address})

        // Take measurements
        appBalances.usd.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.eth.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.eth.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.eth.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.ricx.push((await ricx.balanceOf(u.admin.address)).toString());
        aliceBalances.ricx.push((await ricx.balanceOf(u.alice.address)).toString());
        bobBalances.ricx.push((await ricx.balanceOf(u.bob.address)).toString());

        // Go forward
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME * 10);
        await tp.submitValue(1, 1010000);

        // Distribution, Restart Alice's flow
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        // await web3tx(
        //     sf.host.callAgreement,
        //     "Alice approves subscription to the app"
        // )(
        //     sf.agreements.ida.address,
        //     sf.agreements.ida.contract.methods
        //         .approveSubscription(ethx.address, app.address, 0, "0x")
        //         .encodeABI(),
        //     "0x", // user data
        //     {
        //         from: u.alice.address
        //     }
        // );
        // Distribution - Everyone
        await app.distribute({from: u.admin.address})


        // Take measurements
        appBalances.usd.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.eth.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.eth.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.eth.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.ricx.push((await ricx.balanceOf(u.admin.address)).toString());
        aliceBalances.ricx.push((await ricx.balanceOf(u.alice.address)).toString());
        bobBalances.ricx.push((await ricx.balanceOf(u.bob.address)).toString());


        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME * 10);
        await tp.submitValue(1, 1010000);
        // Distribution
        await app.distribute({from: u.admin.address})


        // Take measurements
        appBalances.usd.push((await daix.balanceOf(u.admin.address)).toString());
        aliceBalances.usd.push((await daix.balanceOf(u.alice.address)).toString());
        bobBalances.usd.push((await daix.balanceOf(u.bob.address)).toString());

        appBalances.eth.push((await ethx.balanceOf(u.admin.address)).toString());
        aliceBalances.eth.push((await ethx.balanceOf(u.alice.address)).toString());
        bobBalances.eth.push((await ethx.balanceOf(u.bob.address)).toString());

        appBalances.ricx.push((await ricx.balanceOf(u.admin.address)).toString());
        aliceBalances.ricx.push((await ricx.balanceOf(u.alice.address)).toString());
        bobBalances.ricx.push((await ricx.balanceOf(u.bob.address)).toString());


        console.log("Bob bal eth", bobBalances)
        console.log("Alice bal eth", aliceBalances)
        console.log("App bal eth", appBalances)


      });

  });

});
