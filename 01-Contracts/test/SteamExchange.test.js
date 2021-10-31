/* eslint-disable no-await-in-loop */
const {
  web3tx,
  toWad,
  wad4human,
  fromDecimals,
  BN,
} = require('@decentral.ee/web3-helpers');
const {
  numberToHex,
} = require('web3-utils');
const {
  expect,
} = require('chai');
const { time } = require('@openzeppelin/test-helpers');
const axios = require('axios').default;
const deployFramework = require('@superfluid-finance/ethereum-contracts/scripts/deploy-framework');
const deployTestToken = require('@superfluid-finance/ethereum-contracts/scripts/deploy-test-token');
const deploySuperToken = require('@superfluid-finance/ethereum-contracts/scripts/deploy-super-token');
const SuperfluidSDK = require('@superfluid-finance/js-sdk');
const traveler = require('ganache-time-traveler');
const SuperfluidGovernanceBase = require('./artifacts/superfluid/SuperfluidGovernanceII.json');

const TEST_TRAVEL_TIME = 3600 * 2; // 1 hours

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function impersonateAccount(account) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [account],
  });
}

async function setBalance(account, balance) {
  const hexBalance = numberToHex(toWad(balance));
  await hre.network.provider.request({
    method: 'hardhat_setBalance',
    params: [
      account,
      hexBalance,
    ],
  });
}
async function impersonateAndSetBalance(account) {
  await impersonateAccount(account);
  await setBalance(account, 10000);
}

async function createSFRegistrationKey(sf, deployer) {
  const registrationKey = `testKey-${Date.now()}`;
  const appKey = web3.utils.sha3(
    web3.eth.abi.encodeParameters(
      ['string', 'address', 'string'],
      [
        'org.superfluid-finance.superfluid.appWhiteListing.registrationKey',
        deployer,
        registrationKey,
      ],
    ),
  );

  const governance = await sf.host.getGovernance.call();
  console.log(`SF Governance: ${governance}`);

  const sfGovernanceRO = await ethers
    .getContractAt(SuperfluidGovernanceBase.abi, governance);

  const govOwner = await sfGovernanceRO.owner();
  await impersonateAndSetBalance(govOwner);

  const sfGovernance = await ethers
    .getContractAt(SuperfluidGovernanceBase.abi, governance, await ethers.getSigner(govOwner));

  await sfGovernance.whiteListNewApp(sf.host.address, appKey);

  return registrationKey;
}

describe('StreamExchange', () => {
  const errorHandler = (err) => {
    if (err) throw err;
  };

  const names = ['Admin', 'Alice', 'Bob', 'Carl', 'Spender'];

  let sf;
  let slp;
  let slpx;
  let sushix;
  let maticx;
  let dai;
  let daix;
  let ethx;
  let wbtc;
  let wbtcx;
  let usd;
  let usdcx;
  let ric;
  let usdc;
  let eth;
  let weth;
  let app;
  let tp; // Tellor playground
  let usingTellor;
  let sr; // Mock Sushi Router
  const ricAddress = '0x263026e7e53dbfdce5ae55ade22493f828922965';
  const u = {}; // object with all users
  const aliases = {};
  let owner;
  let alice;
  let bob;
  let carl;
  let spender;
  const SF_RESOLVER = '0xE0cc76334405EE8b39213E620587d815967af39C';
  const RIC_TOKEN_ADDRESS = '0x263026E7e53DBFDce5ae55Ade22493f828922965';
  const SUSHISWAP_ROUTER_ADDRESS = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
  const SUSHISWAP_MINICHEF_ADDRESS = '0x0769fd68dFb93167989C6f7254cd0D766Fb2841F';
  const TELLOR_ORACLE_ADDRESS = '0xACC2d27400029904919ea54fFc0b18Bf07C57875';
  const TELLOR_REQUEST_ID = 60;

  // random address from polygonscan that have a lot of usdcx
  const USDCX_SOURCE_ADDRESS = '0xA08f80dc1759b12fdC40A4dc64562b322C418E1f';
  const WBTC_SOURCE_ADDRESS = '0x5c2ed810328349100A66B82b78a1791B101C9D61';
  const USDC_SOURCE_ADDRESS = '0x1a13f4ca1d028320a707d99520abfefca3998b7f';
  const SLP_SOURCE_ADDRESS = '0x34965ba0ac2451A34a0471F04CCa3F990b8dea27';
  const SLPX_SOURCE_ADDRESS = '0xEF9d55f9107dA7F85f545330884AacD364FB9670';
  const MATICX_ADDRESS = '0x3aD736904E9e65189c3000c7DD2c8AC8bB7cD4e3';
  const SUSHIX_ADDRESS = '0xDaB943C03f9e84795DC7BF51DdC71DaF0033382b';

  const CARL_ADDRESS = '0x8c3bf3EB2639b2326fF937D041292dA2e79aDBbf';
  const BOB_ADDRESS = '0x00Ce20EC71942B41F50fF566287B811bbef46DC8';
  const ALICE_ADDRESS = '0x9f348cdD00dcD61EE7917695D2157ef6af2d7b9B';
  const OWNER_ADDRESS = '0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA';
  let oraclePrice;

  const appBalances = {
    sushix: [],
    maticx: [],
    slpx: [],
    slp: [],
    usdcx: [],
    ric: [],
  };
  const ownerBalances = {
    sushix: [],
    maticx: [],
    slpx: [],
    slp: [],
    usdcx: [],
    ric: [],
  };
  const aliceBalances = {
    sushix: [],
    maticx: [],
    slpx: [],
    slp: [],
    usdcx: [],
    ric: [],
  };
  const bobBalances = {
    sushix: [],
    maticx: [],
    slpx: [],
    slp: [],
    usdcx: [],
    ric: [],
  };

  async function approveSubscriptions(
    users = [u.alice.address, u.bob.address, u.admin.address],
    tokens = [slpx.address, ricAddress, sushix.address, maticx.address],
  ) {
    // Do approvals
    // Already approved?
    console.log('Approving subscriptions...');

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      for (let userIndex = 0; userIndex < users.length; userIndex += 1) {

        await web3tx(
          sf.host.callAgreement,
          `${users[userIndex]} approves subscription to the app ${tokens[tokenIndex]} ${tokenIndex}`,
        )(
          sf.agreements.ida.address,
          sf.agreements.ida.contract.methods
            .approveSubscription(tokens[tokenIndex], app.address, tokenIndex, '0x')
            .encodeABI(),
          '0x', // user data
          {
            from: users[userIndex],
          },
        );
      }
    }
    console.log('Approved.');
  }

  before(async () => {
    // ==============
    // impersonate accounts and set balances

    const accountAddrs = [OWNER_ADDRESS, ALICE_ADDRESS, BOB_ADDRESS, CARL_ADDRESS, USDCX_SOURCE_ADDRESS];

    accountAddrs.forEach(async (account) => {
      await impersonateAndSetBalance(account);
    });

    // ==============
    // get signers
    owner = await ethers.provider.getSigner(OWNER_ADDRESS);
    alice = await ethers.provider.getSigner(ALICE_ADDRESS);
    bob = await ethers.provider.getSigner(BOB_ADDRESS);
    carl = await ethers.provider.getSigner(CARL_ADDRESS);
    spender = await ethers.provider.getSigner(USDCX_SOURCE_ADDRESS);
    const accounts = [owner, alice, bob, carl, spender];

    // ==============
    // Init Superfluid Framework

    sf = new SuperfluidSDK.Framework({
      web3,
      resolverAddress: SF_RESOLVER,
      tokens: ['WBTC', 'DAI', 'USDC', 'ETH'],
      version: 'v1',
    });
    await sf.initialize();
    ethx = sf.tokens.ETHx;
    wbtcx = sf.tokens.WBTCx;
    daix = sf.tokens.DAIx;
    usdcx = sf.tokens.USDCx;

    // ==============
    // Init SF users

    for (let i = 0; i < names.length; i += 1) {
      u[names[i].toLowerCase()] = sf.user({
        address: accounts[i]._address || accounts[i].address,
        token: usdcx.address,
      });
      u[names[i].toLowerCase()].alias = names[i];
      aliases[u[names[i].toLowerCase()].address] = names[i];
    }

    // ==============
    // NOTE: Assume the oracle is up to date
    // Deploy Tellor Oracle contracts

    const TellorPlayground = await ethers.getContractFactory('TellorPlayground');
    tp = await TellorPlayground.attach(TELLOR_ORACLE_ADDRESS);
    tp = tp.connect(owner);

    // ==============
    // Setup tokens

    const ERC20 = await ethers.getContractFactory('ERC20');
    ric = await ERC20.attach(RIC_TOKEN_ADDRESS);
    weth = await ERC20.attach(await ethx.getUnderlyingToken());
    wbtc = await ERC20.attach(await wbtcx.getUnderlyingToken());
    usdc = await ERC20.attach(await usdcx.getUnderlyingToken());
    ric = ric.connect(owner);

    // Attach alice to the SLP token
    const RT = await ethers.getContractFactory("RicochetToken");
    sushix = await RT.attach(SUSHIX_ADDRESS);
    maticx = await RT.attach(MATICX_ADDRESS);
    sushix = sushix.connect(owner)
    sushix = sushix.connect(owner)

  });

  beforeEach(async () => {
    // ==============
    // Deploy Stream Exchange

    const SLPx = await ethers.getContractFactory("RicochetToken",{
      signer: owner
    });
    slpx = await SLPx.deploy(sf.host.address);
    await slpx.deployed();

    // Initialize Ricochet SLP
    await slpx.initialize(
            SLP_SOURCE_ADDRESS,
            18,
            "Ricochet SLP (USDC/ETH)",
            "rexSLP");



    const StreamExchangeHelper = await ethers.getContractFactory('StreamExchangeHelper');
    const sed = await StreamExchangeHelper.deploy();

    const StreamExchange = await ethers.getContractFactory('StreamExchange', {
      libraries: {
        StreamExchangeHelper: sed.address,
      },
      signer: owner,
    });

    const registrationKey = await createSFRegistrationKey(sf, u.admin.address);

    // NOTE: To attach to existing SE
    // let se = await StreamExchange.attach(STREAM_EXCHANGE_ADDRESS);

    console.log('Deploy params:');
    console.log('SF HOST', sf.host.address);
    console.log('SF CFA', sf.agreements.cfa.address);
    console.log('SF IDA', sf.agreements.ida.address);
    console.log('USDCx', usdcx.address);
    console.log('WBTCx', wbtcx.address);
    console.log('SF Registration Key', registrationKey);

    console.log('Deploying StreamExchange...');

    ERC20 = await ethers.getContractFactory('ERC20');
    slp = await ERC20.attach(SLP_SOURCE_ADDRESS);

    app = await StreamExchange.deploy(sf.host.address,
      sf.agreements.cfa.address,
      sf.agreements.ida.address,
      usdcx.address,
      ethx.address,
      slpx.address,
      RIC_TOKEN_ADDRESS,
      SUSHISWAP_ROUTER_ADDRESS, // sr.address,
      TELLOR_ORACLE_ADDRESS,
      TELLOR_REQUEST_ID,
      registrationKey);
    console.log("Deployed")
    slpx = slpx.connect(owner)
    await slpx.transferOwnership(app.address)
    await app.initialize(slpx.address, ric.address, sushix.address, maticx.address)
    await app.executeApprovals();
    console.log(slpx.address, ric.address, sushix.address, maticx.address)
    console.log('Deployed');


    u.app = sf.user({
      address: app.address,
      token: slpx.address,
    });
    u.app.alias = 'App';

    await approveSubscriptions();

    // ==============
    // Get actual price
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=wrapped-bitcoin&vs_currencies=usd');
    oraclePrice = parseInt(response.data['wrapped-bitcoin'].usd * 1.02 * 1000000).toString();
    console.log('oraclePrice', oraclePrice);
    await tp.submitValue(60, oraclePrice);
  });

  async function checkBalance(user) {
    console.log('Balance of ', user.alias);
    console.log('usdcx: ', (await usdcx.balanceOf(user.address)).toString());
    console.log('slpx: ', (await slpx.balanceOf(user.address)).toString());
  }

  async function checkBalances(accounts) {
    for (let i = 0; i < accounts.length; i += 1) {
      await checkBalance(accounts[i]);
    }
  }

  async function upgrade(accounts) {
    for (let i = 0; i < accounts.length; ++i) {
      await web3tx(
        usdcx.upgrade,
        `${accounts[i].alias} upgrades many USDCx`,
      )(toWad(100000000), {
        from: accounts[i].address,
      });
      await web3tx(
        daix.upgrade,
        `${accounts[i].alias} upgrades many DAIx`,
      )(toWad(100000000), {
        from: accounts[i].address,
      });

      await checkBalance(accounts[i]);
    }
  }

  async function logUsers() {
    let string = 'user\t\ttokens\t\tnetflow\n';
    let p = 0;
    for (const [, user] of Object.entries(u)) {
      if (await hasFlows(user)) {
        p++;
        string += `${user.alias}\t\t${wad4human(
          await usdcx.balanceOf(user.address),
        )}\t\t${wad4human((await user.details()).cfa.netFlow)}
            `;
      }
    }
    if (p == 0) return console.warn('no users with flows');
    console.log('User logs:');
    console.log(string);
  }

  async function hasFlows(user) {
    const {
      inFlows,
      outFlows,
    } = (await user.details()).cfa.flows;
    return inFlows.length + outFlows.length > 0;
  }

  async function appStatus() {
    const isApp = await sf.host.isApp(u.app.address);
    const isJailed = await sf.host.isAppJailed(app.address);
    !isApp && console.error('App is not an App');
    isJailed && console.error('app is Jailed');
    await checkBalance(u.app);
    await checkOwner();
  }

  async function checkOwner() {
    const owner = await u.admin.address;
    console.log('Contract Owner: ', aliases[owner], ' = ', owner);
    return owner.toString();
  }

  async function subscribe(user) {
    // Alice approves a subscription to the app
    console.log(sf.host.callAgreement);
    console.log(sf.agreements.ida.address);
    console.log(usdcx.address);
    console.log(app.address);
    await web3tx(
      sf.host.callAgreement,
      'user approves subscription to the app',
    )(
      sf.agreements.ida.address,
      sf.agreements.ida.contract.methods
        .approveSubscription(slpx.address, app.address, 0, '0x')
        .encodeABI(),
      '0x', // user data
      {
        from: user,
      },
    );
  }

  async function delta(account, balances) {
    const len = balances.maticx.length;
    const changeInMaticxToken = balances.maticx[len - 1] - balances.maticx[len - 2];
    const changeInSushixToken = balances.sushix[len - 1] - balances.sushix[len - 2];
    const changeInSlpxToken = balances.slpx[len - 1] - balances.slpx[len - 2];
    const changeInSlpToken = balances.slp[len - 1] - balances.slp[len - 2];
    const changeInInToken = balances.usdcx[len - 1] - balances.usdcx[len - 2];
    console.log();
    console.log('Change in balances for ', account);
    console.log('Maticx:', changeInMaticxToken, 'Bal:', balances.maticx[len - 1]);
    console.log('Sushix:', changeInSushixToken, 'Bal:', balances.sushix[len - 1]);
    console.log('Slpx:', changeInSlpxToken, 'Bal:', balances.slpx[len - 1]);
    console.log('Slp:', changeInSlpToken, 'Bal:', balances.slp[len - 1]);
    console.log('Usdcx:', changeInInToken, 'Bal:', balances.usdcx[len - 1]);
    return {
      maticx: changeInMaticxToken,
      sushix: changeInSushixToken,
      slpx: changeInSlpxToken,
      usdcx: changeInInToken,
      slp: changeInSlpToken
    }
  }

  async function takeMeasurements() {
    appBalances.sushix.push((await sushix.balanceOf(app.address)).toString());
    ownerBalances.sushix.push((await sushix.balanceOf(u.admin.address)).toString());
    aliceBalances.sushix.push((await sushix.balanceOf(u.alice.address)).toString());
    bobBalances.sushix.push((await sushix.balanceOf(u.bob.address)).toString());

    appBalances.maticx.push((await maticx.balanceOf(app.address)).toString());
    ownerBalances.maticx.push((await maticx.balanceOf(u.admin.address)).toString());
    aliceBalances.maticx.push((await maticx.balanceOf(u.alice.address)).toString());
    bobBalances.maticx.push((await maticx.balanceOf(u.bob.address)).toString());

    appBalances.slpx.push((await slpx.balanceOf(app.address)).toString());
    ownerBalances.slpx.push((await slpx.balanceOf(u.admin.address)).toString());
    aliceBalances.slpx.push((await slpx.balanceOf(u.alice.address)).toString());
    bobBalances.slpx.push((await slpx.balanceOf(u.bob.address)).toString());

    appBalances.slp.push((await slp.balanceOf(app.address)).toString());
    ownerBalances.slp.push((await slp.balanceOf(u.admin.address)).toString());
    aliceBalances.slp.push((await slp.balanceOf(u.alice.address)).toString());
    bobBalances.slp.push((await slp.balanceOf(u.bob.address)).toString());

    appBalances.usdcx.push((await usdcx.balanceOf(app.address)).toString());
    ownerBalances.usdcx.push((await usdcx.balanceOf(u.admin.address)).toString());
    aliceBalances.usdcx.push((await usdcx.balanceOf(u.alice.address)).toString());
    bobBalances.usdcx.push((await usdcx.balanceOf(u.bob.address)).toString());

    appBalances.ric.push((await ric.balanceOf(app.address)).toString());
    ownerBalances.ric.push((await ric.balanceOf(u.admin.address)).toString());
    aliceBalances.ric.push((await ric.balanceOf(u.alice.address)).toString());
    bobBalances.ric.push((await ric.balanceOf(u.bob.address)).toString());
  }

  describe('Stream Exchange', async () => {
    it('should be correctly configured', async () => {
      expect(await app.isAppJailed()).to.equal(false);
      expect(await app.getInputToken()).to.equal(usdcx.address);
      expect(await app.getOuputToken()).to.equal(slpx.address);
      expect(await app.getOuputIndexId()).to.equal(0);
      expect(await app.getSubsidyToken()).to.equal(ric.address);
      expect(await app.getSubsidyIndexId()).to.equal(1);
      expect(await app.getSubsidyRate()).to.equal('400000000000000000');
      expect(await app.getTotalInflow()).to.equal(0);
      expect(await app.getSushiRouter()).to.equal(SUSHISWAP_ROUTER_ADDRESS);
      expect(await app.getTellorOracle()).to.equal(TELLOR_ORACLE_ADDRESS);
      expect(await app.getRequestId()).to.equal(60);
      expect(await app.getOwner()).to.equal(u.admin.address);
      expect(await app.getFeeRate()).to.equal(20000);
    });

    it('should create a stream exchange with the correct parameters', async () => {
      const inflowRate = '77160493827160';
      const inflowRateIDAShares = '77160';

      // await approveSubscriptions([u.admin.address]);

      await u.admin.flow({ flowRate: inflowRate, recipient: u.app });
      // Expect the parameters are correct
      expect(await app.getStreamRate(u.admin.address)).to.equal(inflowRate);
      expect((await app.getIDAShares(0, u.admin.address)).toString()).to.equal(`true,true,${inflowRateIDAShares},0`);
    });

    it('approval should be unlimited', async () => {
      expect(await usdc.allowance(app.address, SUSHISWAP_ROUTER_ADDRESS))
        .to.be.equal(ethers.constants.MaxUint256);
      expect(await weth.allowance(app.address, SUSHISWAP_ROUTER_ADDRESS))
        .to.be.equal(ethers.constants.MaxUint256);
      expect(await slp.allowance(app.address, slpx.address))
        .to.be.equal(ethers.constants.MaxUint256);
    });

    it('should let keepers close streams with < 8 hours left', async () => {
      // await approveSubscriptions([u.bob.address]);
      // 1. Initialize a stream exchange
      const bobUsdcxBalance = await usdcx.balanceOf(u.bob.address);
      // When user create stream, SF locks 4 hour deposit called initial deposit
      const initialDeposit = bobUsdcxBalance.div(new BN('13')).mul(new BN('4'));
      const inflowRate = bobUsdcxBalance.sub(initialDeposit).div(new BN(9 * 3600)).toString();
      // 2. Initialize a streamer with 9 hours of balance
      await u.bob.flow({ flowRate: inflowRate, recipient: u.app });
      expect(await app.getStreamRate(u.bob.address)).to.equal(inflowRate);
      // 3. Verfiy closing attempts revert
      await expect(app.closeStream(u.bob.address)).to.revertedWith('!closable');
      // 4. Advance time 1 hour
      await traveler.advanceTimeAndBlock(3600);
      // 5. Verify closing the stream works
      await app.closeStream(u.bob.address);
      expect(await app.getStreamRate(u.bob.address)).to.equal('0');
    });

    it('should distribute tokens to streamers', async () => {
      // await approveSubscriptions([u.alice.address, u.bob.address]);

      console.log('Transfer alice');
      await usdcx.transfer(u.alice.address, toWad(400), { from: u.spender.address });
      console.log('Transfer bob');
      await usdcx.transfer(u.bob.address, toWad(400), { from: u.spender.address });
      console.log('Done');

      // await takeMeasurements();

      const inflowRate = '1000000000000000';
      const inflowRatex2 = '2000000000000000';
      const inflowRateIDAShares = '1000000';
      const inflowRateIDASharesx2 = '2000000';
      await takeMeasurements();

      await u.alice.flow({ flowRate: inflowRate, recipient: u.app });
      await u.bob.flow({ flowRate: inflowRatex2, recipient: u.app });

      console.log("Check flows")
      expect(await app.getStreamRate(u.alice.address)).to.equal(inflowRate);
      expect((await app.getIDAShares(0, u.alice.address)).toString()).to.equal(`true,true,${inflowRateIDAShares},0`);
      expect(await app.getStreamRate(u.bob.address)).to.equal(inflowRatex2);
      expect((await app.getIDAShares(0, u.bob.address)).toString()).to.equal(`true,true,${inflowRateIDASharesx2},0`);
      await traveler.advanceTimeAndBlock(3600);
      await tp.submitValue(60, oraclePrice);
      console.log("Distribute")
      let tx = await app.distribute();
      let receipt = await tx.wait();
      console.log(receipt);
      console.log(receipt.logs?.filter((x) => {return x.topics[0] == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"}));
      await checkBalances([u.alice, u.bob]);
      await takeMeasurements();
      let deltaAlice = await delta('alice', aliceBalances);
      let deltaBob = await delta('bob', bobBalances);
      let deltaOwner = await delta('owner', ownerBalances);
      // verify
      console.log(deltaOwner)
      console.log(deltaAlice)
      console.log(deltaBob)
      // Fee taken during harvest, can be a larger % of what's actually distributed via IDA due to rounding the actual amount
      expect(deltaOwner.sushix / (deltaAlice.sushix + deltaBob.sushix + deltaOwner.sushix)).to.be.within(0.1,0.12)
      expect(deltaOwner.maticx / (deltaAlice.maticx + deltaBob.maticx + deltaOwner.maticx)).to.be.within(0.1,0.12)
      expect(deltaOwner.slpx / (deltaAlice.slpx + deltaBob.slpx + deltaOwner.slpx)).to.within(0.02, 0.020001)
      expect(deltaAlice.sushix * 2).to.be.within(deltaBob.sushix * 0.999, deltaBob.sushix * 1.001)
      expect(deltaAlice.maticx * 2).to.be.within(deltaBob.maticx * 0.999, deltaBob.maticx * 1.001)
      // expect(deltaAlice.slpx * 2).to.equal(deltaBob.slpx)


      // Test closure, burns tokens returns SLP
      let totalSupply = await slpx.totalSupply()
      await u.alice.flow({ flowRate: "0", recipient: u.app });
      await takeMeasurements();
      deltaAlice = await delta('alice', aliceBalances);
      deltaBob = await delta('bob', bobBalances);
      deltaOwner = await delta('owner', ownerBalances);

      expect(deltaAlice.slpx).to.equal(deltaAlice.slp * -1);
      expect(totalSupply - parseInt(await slpx.totalSupply())).to.equal(deltaAlice.slp)

    });

    it('getters and setters should work properly', async () => {
      await app.connect(owner).setFeeRate(30000);
      await app.connect(owner).setHarvestFeeRate(30000);
      await app.connect(owner).setRateTolerance(30000);
      await app.connect(owner).setSubsidyRate('500000000000000000');
      await app.connect(owner).setOracle(OWNER_ADDRESS);
      await app.connect(owner).setRequestId(61);
      await app.connect(owner).transferOwnership(ALICE_ADDRESS);

      expect(await app.getSubsidyRate()).to.equal('500000000000000000');
      expect(await app.getFeeRate()).to.equal(30000);
      expect(await app.getHarvestFeeRate()).to.equal(100000);
      expect(await app.getRateTolerance()).to.equal(30000);
      expect(await app.getTellorOracle()).to.equal(OWNER_ADDRESS);
      expect(await app.getRequestId()).to.equal(61);
      expect(await app.getOwner()).to.equal(ALICE_ADDRESS);
    });

    it('should correctly emergency drain', async () => {
      // await approveSubscriptions([u.bob.address]);
      const inflowRate = '77160493827160';
      await u.bob.flow({ flowRate: inflowRate, recipient: u.app });
      await traveler.advanceTimeAndBlock(60 * 60 * 12);
      expect((await usdcx.balanceOf(app.address)).toString()).to.not.equal('0');
      await expect(
        app.emergencyDrain(),
      ).to.be.revertedWith('!zeroStreamers');
      await u.bob.flow({ flowRate: '0', recipient: u.app });
      await app.emergencyDrain();
      expect((await usdcx.balanceOf(app.address)).toString()).to.equal('0');
      expect((await wbtcx.balanceOf(app.address)).toString()).to.equal('0');
    });

    it('should emergency close stream if app jailed', async () => {
      const inflowRate = '100000000'; // ~200 * 1e18 per month
      await u.admin.flow({ flowRate: inflowRate, recipient: u.app });
      expect(await app.getStreamRate(u.admin.address)).to.equal(inflowRate);
      await expect(
        app.emergencyCloseStream(u.admin.address),
      ).to.be.revertedWith('!jailed');

      await impersonateAndSetBalance(sf.agreements.cfa.address);
      await web3tx(
        sf.host.jailApp,
        'CFA jails App',
      )(
        '0x',
        app.address,
        0,
        {
          from: sf.agreements.cfa.address,
        },
      );

      expect(await sf.host.isAppJailed(app.address)).to.equal(true);

      await app.emergencyCloseStream(u.admin.address);

      expect(await app.getStreamRate(u.admin.address)).to.equal('0');
    });

  });
});
