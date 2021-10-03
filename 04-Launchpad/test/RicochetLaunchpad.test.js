const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");
const { expect } = require("chai");
const axios = require('axios').default;
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const SuperfluidSDK = require("@superfluid-finance/js-sdk");

const traveler = require("ganache-time-traveler");
const TEST_TRAVEL_TIME = 3600 * 2; // 1 hours

const SF_REG_KEY = process.env.SF_REG_KEY
const CARL_ADDRESS = "0x8c3bf3EB2639b2326fF937D041292dA2e79aDBbf"
const BOB_ADDRESS = "0x00Ce20EC71942B41F50fF566287B811bbef46DC8"
const ALICE_ADDRESS = "0x9f348cdD00dcD61EE7917695D2157ef6af2d7b9B"
const OWNER_ADDRESS = "0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA"

const superTokenAbi=[{"inputs":[{"internalType":"contract ISuperfluid","name":"host","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"bytes","name":"state","type":"bytes"}],"name":"AgreementAccountStateUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":false,"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"AgreementCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"penaltyAccount","type":"address"},{"indexed":true,"internalType":"address","name":"rewardAccount","type":"address"},{"indexed":false,"internalType":"uint256","name":"rewardAmount","type":"uint256"}],"name":"AgreementLiquidated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"liquidatorAccount","type":"address"},{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"penaltyAccount","type":"address"},{"indexed":true,"internalType":"address","name":"bondAccount","type":"address"},{"indexed":false,"internalType":"uint256","name":"rewardAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bailoutAmount","type":"uint256"}],"name":"AgreementLiquidatedBy","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"uint256","name":"slotId","type":"uint256"}],"name":"AgreementStateUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"AgreementTerminated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agreementClass","type":"address"},{"indexed":false,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":false,"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"AgreementUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"tokenHolder","type":"address"}],"name":"AuthorizedOperator","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"bailoutAccount","type":"address"},{"indexed":false,"internalType":"uint256","name":"bailoutAmount","type":"uint256"}],"name":"Bailout","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"Burned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"uuid","type":"bytes32"},{"indexed":false,"internalType":"address","name":"codeAddress","type":"address"}],"name":"CodeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"Minted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"tokenHolder","type":"address"}],"name":"RevokedOperator","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"Sent","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenDowngraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenUpgraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"authorizeOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"createAgreement","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"defaultOperators","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"downgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"getAccountActiveAgreements","outputs":[{"internalType":"contract ISuperAgreement[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"agreementClass","type":"address"},{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"uint256","name":"dataLength","type":"uint256"}],"name":"getAgreementData","outputs":[{"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"agreementClass","type":"address"},{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"slotId","type":"uint256"},{"internalType":"uint256","name":"dataLength","type":"uint256"}],"name":"getAgreementStateSlot","outputs":[{"internalType":"bytes32[]","name":"slotData","type":"bytes32[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCodeAddress","outputs":[{"internalType":"address","name":"codeAddress","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getHost","outputs":[{"internalType":"address","name":"host","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getUnderlyingToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"granularity","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"underlyingToken","type":"address"},{"internalType":"uint8","name":"underlyingDecimals","type":"uint8"},{"internalType":"string","name":"n","type":"string"},{"internalType":"string","name":"s","type":"string"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"isAccountCritical","outputs":[{"internalType":"bool","name":"isCritical","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isAccountCriticalNow","outputs":[{"internalType":"bool","name":"isCritical","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"isAccountSolvent","outputs":[{"internalType":"bool","name":"isSolvent","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isAccountSolventNow","outputs":[{"internalType":"bool","name":"isSolvent","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"address","name":"tokenHolder","type":"address"}],"name":"isOperatorFor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"address","name":"liquidator","type":"address"},{"internalType":"address","name":"penaltyAccount","type":"address"},{"internalType":"uint256","name":"rewardAmount","type":"uint256"},{"internalType":"uint256","name":"bailoutAmount","type":"uint256"}],"name":"makeLiquidationPayouts","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationApprove","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationDowngrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"operationUpgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"operatorBurn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"operatorData","type":"bytes"}],"name":"operatorSend","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"proxiableUUID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"realtimeBalanceOf","outputs":[{"internalType":"int256","name":"availableBalance","type":"int256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint256","name":"owedDeposit","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"realtimeBalanceOfNow","outputs":[{"internalType":"int256","name":"availableBalance","type":"int256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint256","name":"owedDeposit","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"revokeOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"userData","type":"bytes"}],"name":"selfBurn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"userData","type":"bytes"}],"name":"selfMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"send","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"int256","name":"delta","type":"int256"}],"name":"settleBalance","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"uint256","name":"dataLength","type":"uint256"}],"name":"terminateAgreement","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"}],"name":"transferAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"holder","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"},{"internalType":"bytes32[]","name":"data","type":"bytes32[]"}],"name":"updateAgreementData","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"slotId","type":"uint256"},{"internalType":"bytes32[]","name":"slotData","type":"bytes32[]"}],"name":"updateAgreementStateSlot","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newAddress","type":"address"}],"name":"updateCode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"upgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeTo","outputs":[],"stateMutability":"nonpayable","type":"function"}]


describe("RicochetLaunchpad", () => {

  const errorHandler = (err) => {
      if (err) throw err;
  };

  let inputTokenAddress = process.env.INPUT_TOKEN_ADDRESS;  // DAI
  let outputTokenAddress = process.env.OUTPUT_TOKEN_ADDRESS; // RIC
  let inputToken;  // DAI
  let inputTokenUnderlying;  // DAI
  let outputToken; // RIC
  let outputTokenUnderlying; // RIC
  let outputRate = "400000000000000000"
  let feeRate = 20000
  let sf;
  let app;
  let owner;
  let originator;
  let beneficiary;
  let appBalances = {};
  let appDeltas = {};
  const u = {}; // object with all users
  const aliases = {};

  before(async function () {
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
    originator = await ethers.provider.getSigner(ALICE_ADDRESS)

    // Bob
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BOB_ADDRESS]}
    )
    beneficiary = await ethers.provider.getSigner(BOB_ADDRESS)

    // Setup contract connections
    console.log(inputTokenAddress);
    console.log(outputTokenAddress)
    inputToken = await ethers.getContractAt(superTokenAbi, inputTokenAddress);
    outputToken = await ethers.getContractAt(superTokenAbi, outputTokenAddress);

    const ERC20 = await ethers.getContractFactory("ERC20");
    inputTokenUnderlying = await ERC20.attach(await inputToken.getUnderlyingToken());
    outputTokenUnderlying = await ERC20.attach(await outputToken.getUnderlyingToken());

    const accounts = [owner, originator, beneficiary];
    const names = ["owner", "originator", "beneficiary"];

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

    console.log("Owner:", u.owner.address);
    console.log("Host:", sf.host.address);
    console.log("Input Token: ", inputToken.address);
    console.log("Output Token: ", outputToken.address);

    const RicochetLaunchpadHelper = await ethers.getContractFactory("RicochetLaunchpadHelper");
    let rlh = await RicochetLaunchpadHelper.deploy();

    const RicochetLaunchpad = await ethers.getContractFactory("RicochetLaunchpad", {
      libraries: {
        RicochetLaunchpadHelper: rlh.address,
      },
      signer: owner
    });
    app = await RicochetLaunchpad.deploy(sf.host.address,
                                          sf.agreements.cfa.address,
                                          sf.agreements.ida.address,
                                          SF_REG_KEY);
    console.log("Deployed app")
    await app.initialize(inputToken.address,
                         outputToken.address,
                         u.originator.address,
                         u.beneficiary.address,
                         outputRate,
                         feeRate);

    console.log("Deployed and initialized Ricochet Launchpad.")


  });

  beforeEach(async function () {

    // Create a new IRO for a new token before each of the tests
    // Each test starts off with a clean IRO

  });

  describe("RicochetLaunchpad", async function () {
    this.timeout(100000);

    it("should create Launchpad with correct properties", async function() {
      expect(await app.getInputToken()).to.equal(inputToken.address)
      expect(await app.getOutputToken()).to.equal(outputToken.address)
      expect(await app.getOutputIndexId()).to.equal(0)
      expect(await app.getOutputRate()).to.equal(outputRate)
      expect(await app.getFeeRate()).to.equal(feeRate)

    });

    // it("should allow changing Launchpad properties", async function() {
    //   // 1. Initialize a Launchpad contract
    //   // 2. Check all the setters work correctly
    // });
    //
    // it("should createIRO with correct properties", async function() {
    //   // 1. Init Launchpad
    //   // 2. Create an IRO
    //   // 3. Check all the IROs getters
    //   // 4. Check the token balance changes (launchpad +, originator -)
    // });
    //
    // it("should accept streams to an IRO and pay out to the beneficiary and owner", async function() {
    //   // 1. Init Launchpad
    //   // 2. Create an IRO
    //   // 3. Start two streams to the IRO, one for 2x the other
    //   // 4. Check the stream rates and flow rates
    //   // 5. Wait 1 hour
    //   // 6. Check the net amounts flowed and amounts distributed
    //
    // });
    //
    // it("should accept streams to many IROs using many paytokens and pay out to the beneficiary and owner", async function() {
    //   // 1. Init Launchpad
    //   // 2. Create 2 IROs
    //   // 3. Start two streams to each IRO, one for 2x the other
    //   // 4. Check the stream rates and flow rates
    //   // 5. Wait 1 hour
    //   // 6. Check the net amounts flowed and amounts distributed
    // });

  });

});
