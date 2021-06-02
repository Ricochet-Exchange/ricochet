// // In views bc its related to the browser "views"

let erc20_abi
const ETHxAddr = "0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947"; // Goerli - ETHx token
const fUSDCxAddr = "0x8aE68021f6170E5a766bE613cEA0d75236ECCa9a";



async function initiate() {
  // async and await so other things can run simultaneously 
  // Kick-off browser extension
  await ethereum.enable();
  web3 = new Web3(ethereum);
  user = (await web3.eth.getAccounts())[0];
  const networkId = await web3.eth.net.getId();

  // const sf = new SuperfluidSDK.Framework({
  //   web3: web3,
  // });
  // sf.initialize()

  // Get ABIs
  erc20_abi = await (await fetch("./abi/IERC20.json")).json()

  // Show user address on UI to show connection is successful
  getAddress();
  // Changing address of tokens on UI
  getTokenBalance(user,'0x8aE68021f6170E5a766bE613cEA0d75236ECCa9a');
  getTokenBalance(user,'0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947');
  usdcx_balance_call = setInterval(() => getTokenBalance(user,'0x8aE68021f6170E5a766bE613cEA0d75236ECCa9a'),100000);
  ethx_balance_call = setInterval(() => getTokenBalance(user,'0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947'),100000);

  // Test Logs
  console.log("-Web3 check-")
  console.log("User Address:",user);
  console.log("Network:",networkId);
}

async function getAddress() {
  document.getElementById('wallet-address').innerHTML = user;
}

async function getTokenBalance(userAddress,tokenAddress) {
  var tokenInst = new web3.eth.Contract(erc20_abi,tokenAddress);
  tokenInst.methods.balanceOf(userAddress).call().then(function (bal) {
      console.log(tokenAddress,'balance is',bal)
      document.getElementById(`balance-${tokenAddress}`).innerHTML = (bal/1000000000000000000).toFixed(3);
  })
}

// document.getElementById("approve-"+ETHxAddr).addEventListener("click",function() {
//   approve(ETHxAddr);
// }, false);

// async function approve(erc20address) {
//   // Get the address for approval
//   await host.methods.callAgreement(
//       idaAddr, // Goerli
//       ida.methods.approveSubscription(
//           erc20address,
//           appAddr,
//           0,
//           "0x"
//       ).encodeABI(),
//       "0x"
//   ).send({ from: user });
//   await refreshSubscription(erc20address);
// }

// try using Axios instead
// example of getting documents from the server
async function test() {
  console.log("Testing request")
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        // Typical action to be performed when the document is ready:
        console.log(xhttp);
      }
  }
  
  let url = `/test`
  // RestAPI methods are first arg
  xhttp.open("GET", url, true);
  xhttp.send();
}