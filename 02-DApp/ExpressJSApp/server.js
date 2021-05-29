// npm install express meta-auth
// npm install web3
const express = require('express')
const app = express()
const path = require('path')

// main.js to handle browser/ui work
// server.js to handle server worl


// const Window = require('window');
// const window = new Window();

// const Web3 = require('web3')
// const web3 = new Web3(window.ethereum);

// const isMetaMaskInstalled = () => {
//     const { ethereum } = windowW
//     return Boolean(ethereum && ethereum.isMetaMask)
// }

// const initialize = async () => {
//     const isMetaMaskConnected = () => accounts && accounts.length > 0
//     const onClickConnect = async () => {
//         try {
//           const newAccounts = await ethereum.request({
//             method: 'eth_requestAccounts',
//           })
//           handleNewAccounts(newAccounts)
//         } catch (error) {
//           console.error(error)
//         }
//     }
// }

// const getWeb3 = () => {
//   return new Promise((resolve, reject) => {
//     window.addEventListener("load", async () => {
//       if (window.ethereum) {
//         const web3 = new Web3(window.ethereum);
//         try {
//           // ask user permission to access his accounts
//           await window.ethereum.request({ method: "eth_requestAccounts" });
//           resolve(web3);
//         } catch (error) {
//           reject(error);
//         }
//       } else {
//         reject("Must install MetaMask");
//       }
//     });
//   });
// };

// Loading ABIs
const ercJson = require("./abi/IERC20.json")
const idaJson = require("./abi/IInstantDistributionAgreementV1.json")
const isuJson = require("./abi/ISuperfluid.json")
const stxJson = require("./abi/StreamExchange.json")

app.use(express.urlencoded({extended: false}))
// TODO: format CSS better
app.use(express.static(path.join(__dirname,"public")))

app.set("view engine","ejs")
app.set("views",path.join(__dirname,'views'))

app.get('/', (req,res) => {
    res.render("home")
})

app.get('/wallet_address', (req,res) => {
    const walletAddress = req.query.user
    res.send(`${walletAddress} is my wallet address`)
})

// window.addEventListener('DOMContentLoaded', initialize)

app.listen(5000)