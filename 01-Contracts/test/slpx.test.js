const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");
const { expect } = require("chai");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const SuperfluidSDK = require("@superfluid-finance/js-sdk");

const traveler = require("ganache-time-traveler");

// Pre-requisites
// - Tests against mainnet polygon using forking using an Alice wallet
// - Alice wallet needs some SLP tokens
// - Alice wallet can't have any SUSHIx, MATICx

const aliceAddress = "0x3226C9EaC0379F04Ba2b1E1e1fcD52ac26309aeA";
const ownerAddress = "0x1A50a6238eb67285cCD4DF17f75CCe430BAAE2A4";
const lpTokenAddress = "0x34965ba0ac2451A34a0471F04CCa3F990b8dea27";
const maticxAddress = "0x3aD736904E9e65189c3000c7DD2c8AC8bB7cD4e3";
const sushixAddress = "0xDaB943C03f9e84795DC7BF51DdC71DaF0033382b";
const miniChefAddress = "0x0769fd68dFb93167989C6f7254cd0D766Fb2841F";
const pid = "1";
const sfHost = "0x3E14dC1b13c488a8d5D310918780c983bD5982E7";
const sfIDA = "0xB0aABBA4B2783A72C52956CDEF62d438ecA2d7a1";

describe("SLPx", function () {

  let slpx;
  let slp;
  let alice;
  let owner;
  let minichef;
  let maticx;
  let sushix;

  before(async function() {

    // Make Alice
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [aliceAddress]}
    )
    alice = await ethers.getSigner(aliceAddress)

    // Make Deployer
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ownerAddress]}
    )
    owner = await ethers.getSigner(ownerAddress)




    const SLPx = await ethers.getContractFactory("RicochetToken",{
      signer: owner
    });
    slpx = await SLPx.deploy(sfHost);
    await slpx.deployed();

    // Initialize Ricochet SLP
    await slpx.initialize(
            lpTokenAddress,
            18,
            "Ricochet SLP (USDC/ETH)",
            "rexSLP");


    // Attach alice to the SLP token
    const ERC20 = await ethers.getContractFactory("ERC20");
    slp = await ERC20.attach(lpTokenAddress);
    slp = slp.connect(alice)

    sf = new SuperfluidSDK.Framework({
        web3,
        resolverAddress: "0xE0cc76334405EE8b39213E620587d815967af39C",
        tokens: ["WBTC", "DAI", "USDC", "ETH"],
        version: "v1"
    });
    await sf.initialize();


  });

  it("only upgrades/downgrades for owner", async function () {

    // Alice approves her balance of SLP tokens to be upgraded and upgrades
    let aliceSLPBalance = (await slp.balanceOf(alice.address)).toString()
    await slp.approve(slpx.address, aliceSLPBalance);
    slpx = slpx.connect(alice)
    console.log("alice upgrade")
    await expect(slpx.upgrade(aliceSLPBalance)).to.be.revertedWith('Ownable: caller is not the owner');

    console.log("owner transfer")
    await slp.transfer(owner.address, aliceSLPBalance);
    console.log("owner approve")
    slp = slp.connect(owner)
    await slp.approve(slpx.address, aliceSLPBalance);
    slpx = slpx.connect(owner)
    console.log("owner uigrade")
    expect(aliceSLPBalance).to.equal((await slp.balanceOf(owner.address)).toString());
    await slpx.upgrade(aliceSLPBalance)
    expect(aliceSLPBalance).to.equal((await slpx.balanceOf(owner.address)).toString());

    console.log("Owner send alice")
    slpx = slpx.connect(owner);
    await slpx.transfer(alice.address, aliceSLPBalance);
    console.log("Alice downgrade")
    slpx = slpx.connect(alice)
    await expect(slpx.downgrade(aliceSLPBalance)).to.be.revertedWith('Ownable: caller is not the owner');
    console.log("Alice send owner")
    await slpx.transfer(owner.address, aliceSLPBalance);
    slpx = slpx.connect(owner)
    console.log("owner downgrade")
    await slpx.downgrade(aliceSLPBalance)
    expect(aliceSLPBalance).to.equal((await slp.balanceOf(owner.address)).toString());
    slp = slp.connect(owner);
    await slp.transfer(alice.address, aliceSLPBalance);

  });

  it("allows only owner to mint to", async function () {
    slpx = slpx.connect(alice);
    await expect(slpx.mintTo(alice.address, 1000, "0x")).to.be.revertedWith('Ownable: caller is not the owner');

    slpx = slpx.connect(owner);
    let aliceSLPxBalanceBefore = await slpx.balanceOf(alice.address)
    await slpx.mintTo(alice.address, 1000, "0x");
    let aliceSLPxBalanceAfter = await slpx.balanceOf(alice.address)
    expect(aliceSLPxBalanceBefore + 1000).to.equal(aliceSLPxBalanceAfter)


  });

  it("allows only owner to burn from", async function () {
    slpx = slpx.connect(alice);
    await expect(slpx.burnFrom(alice.address, 1000, "0x")).to.be.revertedWith('Ownable: caller is not the owner');

    slpx = slpx.connect(owner);
    let aliceSLPxBalanceBefore = await slpx.balanceOf(alice.address)
    await slpx.burnFrom(alice.address, 1000, "0x");
    let aliceSLPxBalanceAfter = await slpx.balanceOf(alice.address)
    expect(aliceSLPxBalanceBefore - 1000).to.equal(aliceSLPxBalanceAfter)


  });


});
