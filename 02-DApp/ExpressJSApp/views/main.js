// // In views bc its related to the browser "views"

function main() {
    await ethereum.enable();
    web3 = new Web3(ethereum);
    user = (await web3.eth.getAccounts())[0];

    const networkId = await web3.eth.net.getId();
    console.log(user);
    console.log(networkId);
}

main()