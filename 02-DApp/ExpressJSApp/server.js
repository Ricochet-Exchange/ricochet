// npm install express meta-auth
// npm install web3
const express = require('express')
const axios = require('axios')
const app = express()
const path = require('path')

const SuperfluidSDK = require("@superfluid-finance/js-sdk");

var Web3 = require('web3')
var web3 = new Web3(new Web3.providers.HttpProvider("wss://goerli.infura.io/ws/v3/786671decfea4241a9e3c811a-cdf3fe"))
var Eth = require('web3-eth')
var eth = new Eth(Eth.givenProvider)

// Loading ABIs
const ercJson = require("./public/abi/IERC20.json")
const idaJson = require("./public/abi/IInstantDistributionAgreementV1.json")
const isuJson = require("./public/abi/ISuperfluid.json")
const stxJson = require("./public/abi/StreamExchange.json")

app.use(express.urlencoded({extended: false}))
// TODO: format CSS better
app.use(express.static(path.join(__dirname,'public')))
app.set("view engine","ejs")
app.set("views",path.join(__dirname,'views'))

var acct = "Not defined yet"

// const ethEnabled = async () => {
//     if (window.ethereum) {
//       await window.ethereum.send('eth_requestAccounts');
//       window.web3 = new Web3(window.ethereum);
//       return true;
//     }
//     return false;
// }

app.get('/', (req,res) => {
    // console.log(web3.currentProvider)
    res.render("home")
})

app.get('/test', (req,res) => {
    // const walletAddress = req.query
    const sf = new SuperfluidSDK.Framework({
        web3: web3,
    });
    sf.initialize()
    const joel = sf.user({
        address: '0xc41876DAB61De145093b6aA87417326B24Ae4ECD',
        token: '0xF2d68898557cCb2Cf4C10c3Ef2B034b2a69DAD00'
    })

    const details = joel.details()
    console.log(details)
})

// window.addEventListener('DOMContentLoaded', initialize)

app.listen(5007)