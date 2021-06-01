// npm install express meta-auth
// npm install web3
const express = require('express')
const app = express()
const path = require('path')
const { nextTick } = require('process')

var Web3 = require('web3')
var web3 = new Web3(new Web3.providers.HttpProvider("wss://mainnet.infura.io/ws/v3/786671decfea4241a9e3c811abcdf3fe"))
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

// function getAccounts(req,res,next) {
//     req.acct = web3.eth.getAccounts()[0]

//     next()
// }

app.get('/', (req,res) => {
    console.log(web3.currentProvider)
    res.render("home")
})

app.get('/wallet_address', (req,res) => {
    const walletAddress = req.query
    res.send(walletAddress)
})

// window.addEventListener('DOMContentLoaded', initialize)

app.listen(5000)