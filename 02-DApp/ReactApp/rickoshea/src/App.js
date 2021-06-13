// import logo from './logo.svg';
import Web3 from 'web3';
import React, { useState, Component } from 'react';
import './App.css';
import { fUSDCxAddress, ETHxAddress, hostAddress, idaAddress, rickosheaAppAddress } from "./rinkeby_config";
import { erc20ABI, sfABI, idaABI } from "./abis"
const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-helpers");


const SuperfluidSDK = require("@superfluid-finance/js-sdk");

// @ethersproject/providers npm install didn't work
const { Web3Provider } = require("@ethersproject/providers");

// Account 3 (for reference): 0xcf4b5f6ccd39a2b5555ddd9e23f3d0b11843086e

// TODO: catch if user is not on Goerli
class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      account: "-",                // User's address
      network: "",                 // network that user is on - TODO: react to network change
      balance: "",                 // not used
      loading: true,               // (not used yet) boolean for if base interface has loaded
      notConnected: true,          // (not used yet) boolean for if the user has connected wallet
      web3: null,                  // Window-injected web3 object
      // userFlowDetails: null,       // Superfluid user flow details (what flows the user has currently occuring)
      sf: null,                    // Superfluid SDK object
      sfUser:null,                 // Superfluid User object (tied to a specific token)
      host:null,                   // Superfluid host contract instance
      ida:null,                    // Superfluid Instant Distribution Agreement contract instance
      flowAmt:""                   // How much the user has streaming (storing as instance variable so it can be shown on front end)
    };

    this.startFlow = this.startFlow.bind(this);
    this.approve = this.approve.bind(this);
    this.getOnlySuperAppFlows = this.getOnlySuperAppFlows.bind(this);
  }

  componentDidMount() {
    this.loadData();
  }

  async loadData() {
    const web3 = new Web3(window.ethereum)
    try {
      // WEB3 SET UP
      //TODO: handle network switch

      // Connecting to browser injected web3
      await window.ethereum.enable()
      this.setState({notConnected:false})
      this.setState({web3:web3})

      // Gettin user account
      await web3.eth.getAccounts((error,accounts) => {
        this.setState({account:accounts[0]})
        console.log(accounts)
      })

      // Initializing Superfluid framework
      const sf = new SuperfluidSDK.Framework({
        ethers: new Web3Provider(window.ethereum),
        tokens: ['fUSDC','ETH']
      });
      await sf.initialize()

      // Setting some Superfluid instance variables
      // NOTE: this part could be adjusted if working with different input tokens (not just USDCx)
      this.setState({
        sf: sf,
        sfUser: sf.user({
          address: this.state.account,
          token: fUSDCxAddress
        })
      })
      // this.setState({userFlowDetails:await this.state.sfUser.details()})
      // this.setState({
      //   flowAmt: parseInt( ( await this.state.sfUser.details() ).cfa.netFlow ) // TODO: Figure out how to make userFlowDetails a one-stop-shop and not have to pull netflow out of it everytime
      // })
      // this.setState({
      //   flowAmt: this.getOnlySuperAppFlows()
      // })
      this.getOnlySuperAppFlows()
      console.log( "Net flow", this.state.flowAmt )

      // Initializing Superfluid SuperApp components
      this.setState({
        host: await new web3.eth.Contract(
          sfABI,
          hostAddress
        )
      })
      console.log("Host Address:",this.state.host._address)
      this.setState({
        ida: await new web3.eth.Contract(
          idaABI,
          idaAddress
        )
      })
      console.log("IDA Address:",this.state.ida._address)

    } catch {
      console.log("ERROR IN WEB3 SET UP")
    }

    // Handling account switch
    window.ethereum.on('accountsChanged', function (accounts) {
      // this.setState({account:accounts[0]})
      // Re-do the WEB3 SET UP if accounts are changed
      this.loadData()
    }.bind(this))

    // window.ethereum.on('confirmation',() => console.log('test'))

    // Updating token balances on UI
    this.getTokenBalance(this.state.account,fUSDCxAddress)
    this.getTokenBalance(this.state.account,ETHxAddress)
    setInterval(() => this.getTokenBalance(this.state.account,fUSDCxAddress),100000);
    setInterval(() => this.getTokenBalance(this.state.account,ETHxAddress),100000);
  }

  async getTokenBalance(userAddress,tokenAddress) {
    var tokenInst = new this.state.web3.eth.Contract(erc20ABI,tokenAddress);
    console.log("Address in getTokenBalance: ",userAddress)
    tokenInst.methods.balanceOf(userAddress).call().then(function (bal) {
        // console.log(tokenAddress,'balance is',bal)
        document.getElementById(`balance-${tokenAddress}`).innerHTML = (bal/1000000000000000000).toFixed(10);
    })
  }

  // Starting a Superfluid flow based on what user selects in field
  async startFlow() {
    let sf = this.state.sf
    let sfUser = this.state.sfUser
    console.log("Creating flow with:",sfUser)
    const userData = { message: "here's a flow account 2", flowId: "1" } // This is just arbitrary

    let flowInput = Math.round( ( document.getElementById("input-amt-"+ETHxAddress).value * Math.pow(10,18) ) / 2592000 ) // Say I start a stream of 10 USDCx per month. Is the flow in gwei (which is registered as to the second) calculated as [ (10 USDCx) *(10^18) ] / [30 * 24 * 60 * 60]  = 3858024691358.025 -> round to nearest int
    console.log("Would flow:",flowInput)
    await sfUser.flow({
      recipient: await sf.user({ address: rickosheaAppAddress, token: fUSDCxAddress }), // address: would be rickosheaAppaddress, currently not deployed
      flowRate: flowInput.toString(),
      options: {
        userData
      }
    })

    document.getElementById("input-amt-"+ETHxAddress).value = ""

    // Defensive code: For some reason getOnlySuperAppFlows() doesn't update flowAmt properly when it's zero
    if (flowInput===0) {
      this.setState({
        flowAmt: 0
      })
    } else {
      this.getOnlySuperAppFlows()
    }
  }


  async getOnlySuperAppFlows() {
    let details = (await this.state.sfUser.details()).cfa.flows.outFlows

    var i
    for (i=0; i<details.length;i++) {
      if (details[i].receiver === rickosheaAppAddress) {
        console.log("Here's the stream to the superapp",details[i].flowRate)
        this.setState({
          flowAmt: -details[i].flowRate
        })
      }
    }
  }

  // Approving SuperApp to send us ETHx
  // NOT USABLE YET - rickoshea app hasn't been deployed, address is fake
  async approve() {
    let indexId = "0";
    let subscriber = this.state.sfUser.address;

    // sf.agreements.ida.contract.methods
    //     .approveSubscription(ethx.address, app.address, 0, "0x")
    //     .encodeABI()
    // await this.state.sf.agreements.ida.approveSubscription({
    //     superToken: ETHxAddress,
    //     indexId: indexId,
    //     publisher: rickosheaAppAddress,
    //     subscriber: subscriber,
    //     userData: "0x"});
    // //     TODO: refreshSupscription
    console.log("IDA!:", this.state.sf.agreements.ida.contract.methods
        .approveSubscription(ETHxAddress, rickosheaAppAddress, 0, new bytes(0))
        .encodeABI())

    await web3tx(
        this.state.sf.host.callAgreement,
        "Bob approves subscription to the app"
    )(
        this.state.sf.agreements.ida.address,
        this.state.sf.agreements.ida.contract.methods
            .approveSubscription(ETHxAddress, rickosheaAppAddress, 0, new bytes(0))
            .encodeABI(),
        "0x", // user data
        {
            from: subscriber
        }
    );
  }

  // Refreshing to see if user has already approved ETHx subscription
  // TODO: make it such that you pass in a parameter with the DCA Recieving token so it can vary (not just ETHx)
  // NOT USABLE YET - rickoshea app hasn't been deployed, address is fake
  async refreshSubscription() {
    const sub = await this.state.ida.methods.getSubscription(
      ETHxAddress,
      rickosheaAppAddress,
      0,
      this.state.sfUser.address
    ).call()
    // console.log(sub)
    if (sub.approved) {
      console.log("User has already approved SuperApp Subscription")
      let abtn = document.getElementById("approve-"+ETHxAddress)
      let sfld = document.getElementById("input-amt-"+ETHxAddress)
      let fbtn = document.getElementById("startFlowButton")
      abtn.disabled = true
      sfld.disabled = false
      fbtn.disabled = false
    }
  }

  render() {
    // var flowAmt = parseInt( this.state.userFlowDetails.cfa.netFlow )
    return (
      <body class="indigo lighten-4">
          <div class="row">
            <div class = "col">
              <p>[Rick's Face]</p>
            </div>
            <div class = "col">
              <h3>Rickoshea</h3>
              <p>Scaling and simplifying Dollar-cost Averaging (DCA)</p>
            </div>
            <div class= "col">
              <strong><span id="wallet-address">Your Address: {this.state.account}</span></strong>
            </div>
          </div>

          <div class="col">
            <div class="card grey darken-1">
              <div class="card-content white-text">
                <table style={{width:100}}>
                  <tr>
                    <th></th>
                    <th>App Address (fake)</th>
                    {/* <th>Inbound Rate</th> */}
                    <th>Balance</th>
                    <th>DCA Asset Balance</th>
                    <th colspan="3">Start a DCA Flow</th>
                  </tr>
                  <tr>
                    <td>ETHx</td>
                    {/* <!-- "App Address":Address of Super App -->                   */}
                    <td>{rickosheaAppAddress}<br/></td>
                    {/* <!-- "Inbound Rate":Rate at which you will be recieving the DCA asset -->
                    <td><div id='inbound-rate'>0</div> ETHx/hr</td> */}
                    {/* <!-- "Total Inflow":Balance of USDCx in wallet --> */}
                    <td><div id='balance-0x0F1D7C55A2B133E000eA10EeC03c774e0d6796e8'>0</div> USDCx</td>
                    {/* <!-- "Total Outflow":Balance of DCA asset in wallet --> */}
                    <td><span id="balance-0xa623b2DD931C5162b7a0B25852f4024Db48bb1A0">0</span> ETHx</td>
                    {/* <!-- Stream Initiation --> */}
                    {/* <!-- EVENTUALLY, we want to make approve() to happen onClick, kick off interfacing with SuperApp --> */}
                    {/* <td><button id="approve-0xa623b2DD931C5162b7a0B25852f4024Db48bb1A0" placeholder="Please approve first" onClick={this.approve}>Approve</button> </td>  */}
                    <td><input type="text" id="input-amt-0xa623b2DD931C5162b7a0B25852f4024Db48bb1A0" placeholder={"Current Flow: "+ ( -( this.state.flowAmt*(30*24*60*60) )/Math.pow(10,18) ).toFixed(4)  }/> USDCx/month</td>
                    {/* <td><button id="start-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947" disabled>Stream</button> </td> */}
                    <td><button id="startFlowButton" onClick={this.startFlow}>Start Flow</button> </td>
                    <td><button id="approveDistButton" onClick={this.approve}>Approve</button> </td>
                  </tr>
                </table>
              </div>
            </div>
          </div>
      </body>
    );
  }
}

export default App;

    // calcing flow rate: 10 USDC/month:
    // {"cfa":
    //   {"flows":
    //     {"inFlows":[],
    //     "outFlows":[{"sender":"0xc41876DAB61De145093b6aA87417326B24Ae4ECD",
    //                  "receiver":"0xf40C0a8D9bCf57548a6afF14374ac02D2824660A",
    //                  "flowRate":"3858024691358"}]},
    //     "netFlow":"-3858024691358"},
    //   "ida":{"subscriptions":[]}}

    // If
