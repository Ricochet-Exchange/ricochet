// import logo from './logo.svg';
import Web3 from 'web3';
import React, { useState, Component } from 'react';
import './App.css';
import { erc20ABI, fUSDCxAddress, ETHxAddress } from "./goerli_config.js";

const SuperfluidSDK = require("@superfluid-finance/js-sdk");

// @ethersproject/providers npm install didn't work
const { Web3Provider } = require("@ethersproject/providers");

// TODO: catch if user is not on Goerli
class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      account: "-",
      network: "",
      balance: "",
      loading: true,
      notConnected: true,
      web3:null,
      userFlowDetails:null,
      sfUser:null
    };

  }

  componentDidMount() {
    this.loadData();
  }

  async loadData() {
    const web3 = new Web3(window.ethereum)
    try {

      // WEB3 SET UP
      await window.ethereum.enable()
      this.setState({notConnected:false})
      this.setState({web3:web3})
      await web3.eth.getAccounts((error,accounts) => {
      this.setState({account:accounts[0]})
        console.log("State Account 45",this.state.account)
        console.log(accounts)
      })

      const sf = new SuperfluidSDK.Framework({
        ethers: new Web3Provider(window.ethereum)
      });
      await sf.initialize()

      this.setState({sfUser: sf.user({
                                        address: this.state.account,
                                        token: fUSDCxAddress
                                      })
                    })

      this.setState({userFlowDetails:await this.state.sfUser.details()})
      console.log(JSON.stringify(this.state.userFlowDetails))
      // console.log(userFlowDetails.)

    } catch {
      console.log("ERROR")
    }

    // Handling account switch
    window.ethereum.on('accountsChanged', function (accounts) {
      // this.setState({account:accounts[0]})
      // Re-do the WEB3 SET UP if accounts are changed
      this.loadData()
    }.bind(this))

    // Updating token balances on UI
    this.getTokenBalance(this.state.account,fUSDCxAddress)
    this.getTokenBalance(this.state.account,ETHxAddress)
    setInterval(() => this.getTokenBalance(this.state.account,fUSDCxAddress),100000);
    setInterval(() => this.getTokenBalance(this.state.account,ETHxAddress),100000);
  }

  async getTokenBalance(userAddress,tokenAddress) {
    // console.log('Top1')
    var tokenInst = new this.state.web3.eth.Contract(erc20ABI,tokenAddress);
    // console.log('Bottom1')
    // console.log(userAddress)
    tokenInst.methods.balanceOf(userAddress).call().then(function (bal) {
        console.log(tokenAddress,'balance is',bal)
        // console.log('Top2')
        document.getElementById(`balance-${tokenAddress}`).innerHTML = (bal/1000000000000000000).toFixed(10);
        // console.log('Bottom2')
    })
  }

  // async startFlow () {
  //   await this.state.sfUser.flow({
  //     reci
  //   })
  // }

  render() { 
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
                    <th>App Address</th>
                    <th>Inbound Rate</th>
                    <th>Total Inflow</th>
                    <th>Total Outflow</th>
                    <th colspan="3">Start a DCA Flow</th>
                  </tr>
                  <tr>
                    <td>ETHx</td>
                    {/* <!-- "App Address":Address of Super App -->                   */}
                    <td>0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947<br/></td>
                    {/* <!-- "Inbound Rate":Rate at which you will be recieving the DCA asset -->*/}
                    <td><div id='inbound-rate'>0</div> ETHx/hr</td>
                    {/* <!-- "Total Inflow":Balance of USDCx in wallet --> */}
                    <td><div id='balance-0x8aE68021f6170E5a766bE613cEA0d75236ECCa9a'>0</div> USDCx</td>
                    {/* <!-- "Total Outflow":Balance of DCA asset in wallet --> */}
                    <td><span id="balance-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947">0</span> ETHx</td>
                    {/* <!-- Stream Initiation --> */}
                    {/* <!-- <td><button onclick="approve()" id="approve-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947" placeholder="Please approve first">Approve</button> </td> --> */}
                    <td><button id="approve-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947" placeholder="Please approve first">Approve</button> </td>
                    <td><input type="text" id="input-amt-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947" disabled/> USDCx/month</td>
                    <td><button id="start-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947" disabled>Stream</button> </td>
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
