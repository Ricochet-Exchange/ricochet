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

    const names = ["Admin", "Alice", "Bob"];

    let sf;
    let dai;
    let daix;
    let app;
    let tp; // Tellor playground
    let usingTellor;
    let sr; // Mock Sushi Router
    const u = {}; // object with all users
    const aliases = {};

    before(async function () {
        //process.env.RESET_SUPERFLUID_FRAMEWORK = 1;
        const [owner, alice, bob] = await ethers.getSigners();
        await deployFramework(errorHandler, {
            web3,
            from: owner.address,
        });
    });

    beforeEach(async function () {
        const [owner, alice, bob] = await ethers.getSigners();
        const accounts = [owner, alice, bob] ;
        await deployTestToken(errorHandler, [":", "fDAI"], {
            web3,
            from: owner.address,
        });
        await deployTestToken(errorHandler, [":", "ETH"], {
            web3,
            from: owner.address,
        });
        await deploySuperToken(errorHandler, [":", "fDAI"], {
            web3,
            from: owner.address,
        });
        await deploySuperToken(errorHandler, [":", "ETH"], {
            web3,
            from: owner.address,
        });

        sf = new SuperfluidSDK.Framework({
            web3,
            version: "test",
            tokens: ["fDAI", "ETH"],
        });
        await sf.initialize();
        daix = sf.tokens.fDAIx;
        ethx = sf.tokens.ETHx;
        dai = await sf.contracts.TestToken.at(await sf.tokens.fDAI.address);
        eth = await sf.contracts.TestToken.at(await sf.tokens.ETH.address);
        for (var i = 0; i < names.length; i++) {
            u[names[i].toLowerCase()] = sf.user({
                address: accounts[i].address,
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

        await tp.submitValue(1, 2400000000);

        const UsingTellor = await ethers.getContractFactory("UsingTellor");
        usingTellor = await UsingTellor.deploy(tp.address);

        // Mocking Sushiswap Router
        const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
        sr = await MockUniswapRouter.deploy(tp.address, 1, eth.address);


        const StreamExchange = await ethers.getContractFactory("StreamExchange");
        app = await StreamExchange.deploy(sf.host.address,
                                          sf.agreements.cfa.address,
                                          sf.agreements.ida.address,
                                          daix.address,
                                          ethx.address,
                                          sr.address,
                                          tp.address,
                                          1);
        console.log("App made")
        u.app = sf.user({ address: app.address, token: daix.address });
        u.app.alias = "App";
        await checkBalance(u.app);
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
        const owner = await app.owner();
        console.log("Contract Owner: ", aliases[owner], " = ", owner);
        return owner.toString();
    }

    async function transferNFT(to) {
        const receiver = to.address || to;
        const owner = await checkOwner();
        console.log("got owner from checkOwner(): ", owner);
        console.log("receiver: ", receiver);
        if (receiver === owner) {
            console.log("user === owner");
            return false;
        }
        await app.transferFrom(owner, receiver, 1, { from: owner });
        console.log(
            "token transferred, new owner: ",
            receiver,
            " = ",
            aliases[receiver]
        );
        return true;
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

      it("should distribute output tokens to streamers", async() => {

        const inflowRate = toWad(0.00004000);

        // Give the app a bit of each token to start
        await upgrade([u.alice, u.bob, u.admin]);
        await daix.transfer(app.address, toWad(10), {from: u.admin.address});
        await ethx.transfer(app.address, toWad(10), {from: u.admin.address});
        await ethx.downgrade(toWad(5), {from: u.admin.address})
        await eth.transfer(sr.address, toWad(5), {from: u.admin.address});

        // Take a measurement
        const appInitialBalance = await daix.balanceOf(app.address);
        const bobInitialBalance = await daix.balanceOf(u.bob.address);
        const aliceInitialBalance = await daix.balanceOf(u.alice.address);
        const adminInitialBalance = await daix.balanceOf(u.admin.address);
        const appInitialBalanceEth = await ethx.balanceOf(app.address);
        const aliceInitialBalanceEth = await ethx.balanceOf(u.alice.address);
        const bobInitialBalanceEth = await ethx.balanceOf(u.bob.address);

        // Alice opens a stream into the app
        // await subscribe(u.alice);  // TODO
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });

        // Go forward 2 hours
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME);

        // Take a Measurement
        const appInnerBalance = await daix.balanceOf(app.address);
        const aliceInnerBalance = await daix.balanceOf(u.alice.address);
        const bobInnerBalance = await daix.balanceOf(u.bob.address);
        const adminInnerBalance = await daix.balanceOf(u.admin.address);
        const appInnerBalanceEth = await ethx.balanceOf(app.address);
        const aliceInnerBalanceEth = await ethx.balanceOf(u.alice.address);


        expect((await u.app.details()).cfa.netFlow).to.equal("80000000000000", "app net flow");
        // expect(appInitialBalance.toString()).to.equal(appInnerBalance.toString(), "app balance changed");
        await tp.submitValue(1, 2400000000);
        // Do a distribution
        await app.distribute({from: u.admin.address})

        await appStatus();
        await logUsers();

        const appFinalBalance = await daix.balanceOf(app.address);
        const aliceFinalBalance = await daix.balanceOf(u.alice.address);
        const adminFinalBalance = await daix.balanceOf(u.admin.address);
        const appFinalBalanceEth = await ethx.balanceOf(app.address);
        const aliceFinalBalanceEth = await ethx.balanceOf(u.alice.address);

        // Confirm the correct amounts were deducted, added
        expect(parseInt(appFinalBalanceEth - appInitialBalanceEth)).to.be.below(1e15, "app dist amount"); // 1e15 == dust amount?
        // TODO: approve subscribe test code
        // expect((aliceFinalBalanceEth - aliceInitialBalanceEth).toString()).to.equal(ethPerTimeTravel, "alice dist amount")

      });

      it("should not distribute output tokens to streamers after they cancel their stream", async() => {
        const exchangeRate = 3450;
        const inflowRate = toWad(0.00004000);

        // Give the app a bit of each token to start
        await upgrade([u.alice, u.bob, u.admin]);
        await daix.transfer(app.address, toWad(10), {from: u.admin.address});
        await ethx.transfer(app.address, toWad(10), {from: u.admin.address});
        await ethx.downgrade(toWad(5), {from: u.admin.address})
        await eth.transfer(sr.address, toWad(5), {from: u.admin.address});

        // Take a measurement
        const appInitialBalance = await daix.balanceOf(app.address);
        const bobInitialBalance = await daix.balanceOf(u.bob.address);
        const aliceInitialBalance = await daix.balanceOf(u.alice.address);
        const adminInitialBalance = await daix.balanceOf(u.admin.address);
        const appInitialBalanceEth = await ethx.balanceOf(app.address);
        const aliceInitialBalanceEth = await ethx.balanceOf(u.alice.address);
        const bobInitialBalanceEth = await ethx.balanceOf(u.bob.address);

        // Alice opens a stream into the app
        // await subscribe(u.alice);  // TODO
        await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
        await u.bob.flow({ flowRate: inflowRate, recipient: u.app });

        // Go forward 2 hours
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME);

        // Take a Measurement
        const appInnerBalance = await daix.balanceOf(app.address);
        const aliceInnerBalance = await daix.balanceOf(u.alice.address);
        const bobInnerBalance = await daix.balanceOf(u.bob.address);
        const adminInnerBalance = await daix.balanceOf(u.admin.address);
        const appInnerBalanceEth = await ethx.balanceOf(app.address);
        const aliceInnerBalanceEth = await ethx.balanceOf(u.alice.address);

        await tp.submitValue(1, 2400000000);

        // Do a distribution
        await app.distribute({from: u.admin.address})
        expect((await u.app.details()).cfa.netFlow).to.equal("80000000000000", "app net flow");

        // Cancel Alice's flow
        await u.alice.flow({ flowRate: "0", recipient: u.app });

        // Go forward 2 hours
        await traveler.advanceTimeAndBlock(TEST_TRAVEL_TIME);

        await tp.submitValue(1, 2400000000);
        // Do a distribution
        await app.distribute({from: u.admin.address})

        await appStatus();
        await logUsers();

        const appFinalBalance = await daix.balanceOf(app.address);
        const aliceFinalBalance = await daix.balanceOf(u.alice.address);
        const adminFinalBalance = await daix.balanceOf(u.admin.address);
        const appFinalBalanceEth = await ethx.balanceOf(app.address);
        const aliceFinalBalanceEth = await ethx.balanceOf(u.alice.address);

        // Confirm the correct amounts were deducted, added
        // NOTE: These values hard coded are _assumed_ to be correct but need validation
        expect(parseInt(appFinalBalanceEth - appInitialBalanceEth)).to.be.below(1e15, "app dist amount"); // 1e15 == dust amount?
        expect((await u.app.details()).cfa.netFlow).to.equal("40000000000000", "app net flow");
        // TODO: approve subscribe test code
        // expect((aliceFinalBalanceEth - aliceInitialBalanceEth).toString()).to.equal(ethPerTimeTravel, "alice dist amount")

      });

  });

});
