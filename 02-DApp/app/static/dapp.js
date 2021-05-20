
async function ethEnabled() {
    // If the browser has an Ethereum provider (MetaMask) installed
    if (window.ethereum) {
        window.web3 = new Web3(window.ethereum);
        window.ethereum.enable();
        return true;
    }
    return false;
}


async function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Number.parseFloat((progress * (end - start) + start)).toFixed(3);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
  }


async function startAnimation() {

    const rate = $("#dapp-createflow-dca-rate").val();
    const superapp_address = $("#dapp-createflow-superapp-address").val();

    console.log(rate);
    console.log(superapp_address);

    const changing_num = document.getElementById("stream-num");
    const inbound_rate_ETHx = document.getElementById("inbound-rate");
    let inbound_rate_USDC = document.getElementById("input-amt-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947").value
    inbound_rate_ETHx.innerHTML = Number.parseFloat(inbound_rate_USDC/3500).toFixed(3);

    this.animateValue(changing_num,0,100000,100000000000)

    return;

}

let res_abi =  [
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluid",
        "name": "host",
        "type": "address"
      },
      {
        "internalType": "contract IConstantFlowAgreementV1",
        "name": "cfa",
        "type": "address"
      },
      {
        "internalType": "contract IInstantDistributionAgreementV1",
        "name": "ida",
        "type": "address"
      },
      {
        "internalType": "contract ISuperToken",
        "name": "inputToken",
        "type": "address"
      },
      {
        "internalType": "contract ISuperToken",
        "name": "outputToken",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalAmount",
        "type": "uint256"
      }
    ],
    "name": "Distribution",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint96",
        "name": "rate",
        "type": "uint96"
      }
    ],
    "name": "NewInboundStream",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint96",
        "name": "rate",
        "type": "uint96"
      }
    ],
    "name": "NewOutboundStream",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "INDEX_ID",
    "outputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "RATE_PERCISION",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "_superToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_agreementClass",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "_ctx",
        "type": "bytes"
      }
    ],
    "name": "afterAgreementCreated",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "_superToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_agreementClass",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "_ctx",
        "type": "bytes"
      }
    ],
    "name": "afterAgreementTerminated",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "_superToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_agreementClass",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "_ctx",
        "type": "bytes"
      }
    ],
    "name": "afterAgreementUpdated",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "beforeAgreementCreated",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "beforeAgreementTerminated",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "beforeAgreementUpdated",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "distribute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getlastDistributionAt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "rate",
        "type": "uint256"
      }
    ],
    "name": "setExchangeRate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
let sf_abi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "agreementType",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "code",
        "type": "address"
      }
    ],
    "name": "AgreementClassRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "agreementType",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "code",
        "type": "address"
      }
    ],
    "name": "AgreementClassUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      }
    ],
    "name": "AppRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "contract ISuperfluidGovernance",
        "name": "oldGov",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "contract ISuperfluidGovernance",
        "name": "newGov",
        "type": "address"
      }
    ],
    "name": "GovernanceReplaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reason",
        "type": "uint256"
      }
    ],
    "name": "Jail",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "contract ISuperTokenFactory",
        "name": "newFactory",
        "type": "address"
      }
    ],
    "name": "SuperTokenFactoryUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "code",
        "type": "address"
      }
    ],
    "name": "SuperTokenLogicUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "bitmap",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "agreementType",
        "type": "bytes32"
      }
    ],
    "name": "addToAgreementClassesBitmap",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "newBitmap",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "targetApp",
        "type": "address"
      }
    ],
    "name": "allowCompositeApp",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      },
      {
        "internalType": "int256",
        "name": "allowanceUsedDelta",
        "type": "int256"
      }
    ],
    "name": "appCallbackPop",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      },
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "appAllowanceGranted",
        "type": "uint256"
      },
      {
        "internalType": "int256",
        "name": "appAllowanceUsed",
        "type": "int256"
      }
    ],
    "name": "appCallbackPush",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "appCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint32",
            "name": "operationType",
            "type": "uint32"
          },
          {
            "internalType": "address",
            "name": "target",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "internalType": "struct ISuperfluid.Operation[]",
        "name": "operations",
        "type": "tuple[]"
      }
    ],
    "name": "batchCall",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperAgreement",
        "name": "agreementClass",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "callAgreement",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "returnedData",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperAgreement",
        "name": "agreementClass",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "callAgreementWithContext",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "returnedData",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      }
    ],
    "name": "callAppAction",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "returnedData",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "callAppActionWithContext",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      },
      {
        "internalType": "bool",
        "name": "isTermination",
        "type": "bool"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "callAppAfterCallback",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "appCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "callData",
        "type": "bytes"
      },
      {
        "internalType": "bool",
        "name": "isTermination",
        "type": "bool"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "callAppBeforeCallback",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "cbdata",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "allowanceWantedMore",
        "type": "uint256"
      },
      {
        "internalType": "int256",
        "name": "allowanceUsedDelta",
        "type": "int256"
      }
    ],
    "name": "ctxUseAllowance",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "decodeCtx",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint8",
            "name": "appLevel",
            "type": "uint8"
          },
          {
            "internalType": "uint8",
            "name": "callType",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "msgSender",
            "type": "address"
          },
          {
            "internalType": "bytes4",
            "name": "agreementSelector",
            "type": "bytes4"
          },
          {
            "internalType": "bytes",
            "name": "userData",
            "type": "bytes"
          },
          {
            "internalType": "uint256",
            "name": "appAllowanceGranted",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "appAllowanceWanted",
            "type": "uint256"
          },
          {
            "internalType": "int256",
            "name": "appAllowanceUsed",
            "type": "int256"
          },
          {
            "internalType": "address",
            "name": "appAddress",
            "type": "address"
          }
        ],
        "internalType": "struct ISuperfluid.Context",
        "name": "context",
        "type": "tuple"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint32",
            "name": "operationType",
            "type": "uint32"
          },
          {
            "internalType": "address",
            "name": "target",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "internalType": "struct ISuperfluid.Operation[]",
        "name": "operations",
        "type": "tuple[]"
      }
    ],
    "name": "forwardBatchCall",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "agreementType",
        "type": "bytes32"
      }
    ],
    "name": "getAgreementClass",
    "outputs": [
      {
        "internalType": "contract ISuperAgreement",
        "name": "agreementClass",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      }
    ],
    "name": "getAppLevel",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "appLevel",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      }
    ],
    "name": "getAppManifest",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isSuperApp",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "isJailed",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "noopMask",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getGovernance",
    "outputs": [
      {
        "internalType": "contract ISuperfluidGovernance",
        "name": "governance",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSuperTokenFactory",
    "outputs": [
      {
        "internalType": "contract ISuperTokenFactory",
        "name": "factory",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSuperTokenFactoryLogic",
    "outputs": [
      {
        "internalType": "address",
        "name": "logic",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperAgreement",
        "name": "agreementClass",
        "type": "address"
      }
    ],
    "name": "isAgreementClassListed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "yes",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "agreementType",
        "type": "bytes32"
      }
    ],
    "name": "isAgreementTypeListed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "yes",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      }
    ],
    "name": "isApp",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      }
    ],
    "name": "isAppJailed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isJail",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "contract ISuperApp",
        "name": "targetApp",
        "type": "address"
      }
    ],
    "name": "isCompositeAppAllowed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isAppAllowed",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "isCtxValid",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      },
      {
        "internalType": "contract ISuperApp",
        "name": "app",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "reason",
        "type": "uint256"
      }
    ],
    "name": "jailApp",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "bitmap",
        "type": "uint256"
      }
    ],
    "name": "mapAgreementClasses",
    "outputs": [
      {
        "internalType": "contract ISuperAgreement[]",
        "name": "agreementClasses",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperAgreement",
        "name": "agreementClassLogic",
        "type": "address"
      }
    ],
    "name": "registerAgreementClass",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "configWord",
        "type": "uint256"
      }
    ],
    "name": "registerApp",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "configWord",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "registrationKey",
        "type": "string"
      }
    ],
    "name": "registerAppWithKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "bitmap",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "agreementType",
        "type": "bytes32"
      }
    ],
    "name": "removeFromAgreementClassesBitmap",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "newBitmap",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidGovernance",
        "name": "newGov",
        "type": "address"
      }
    ],
    "name": "replaceGovernance",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperAgreement",
        "name": "agreementClassLogic",
        "type": "address"
      }
    ],
    "name": "updateAgreementClass",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperTokenFactory",
        "name": "newFactory",
        "type": "address"
      }
    ],
    "name": "updateSuperTokenFactory",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperToken",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "updateSuperTokenLogic",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
let erc20_abi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
let ida_abi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "IndexCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "IndexSubscribed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "units",
        "type": "uint128"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "IndexUnitsUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "IndexUnsubscribed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "oldIndexValue",
        "type": "uint128"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "newIndexValue",
        "type": "uint128"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "totalUnitsPending",
        "type": "uint128"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "totalUnitsApproved",
        "type": "uint128"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "IndexUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "SubscriptionApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "SubscriptionRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "units",
        "type": "uint128"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "userData",
        "type": "bytes"
      }
    ],
    "name": "SubscriptionUnitsUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "agreementType",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "approveSubscription",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "calculateDistribution",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "actualAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint128",
        "name": "newIndexValue",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "claim",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "createIndex",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "deleteSubscription",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "distribute",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      }
    ],
    "name": "getIndex",
    "outputs": [
      {
        "internalType": "bool",
        "name": "exist",
        "type": "bool"
      },
      {
        "internalType": "uint128",
        "name": "indexValue",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "totalUnitsApproved",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "totalUnitsPending",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      }
    ],
    "name": "getSubscription",
    "outputs": [
      {
        "internalType": "bool",
        "name": "exist",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      },
      {
        "internalType": "uint128",
        "name": "units",
        "type": "uint128"
      },
      {
        "internalType": "uint256",
        "name": "pendingDistribution",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "agreementId",
        "type": "bytes32"
      }
    ],
    "name": "getSubscriptionByID",
    "outputs": [
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      },
      {
        "internalType": "uint128",
        "name": "units",
        "type": "uint128"
      },
      {
        "internalType": "uint256",
        "name": "pendingDistribution",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      }
    ],
    "name": "listSubscriptions",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "publishers",
        "type": "address[]"
      },
      {
        "internalType": "uint32[]",
        "name": "indexIds",
        "type": "uint32[]"
      },
      {
        "internalType": "uint128[]",
        "name": "unitsList",
        "type": "uint128[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "time",
        "type": "uint256"
      }
    ],
    "name": "realtimeBalanceOf",
    "outputs": [
      {
        "internalType": "int256",
        "name": "dynamicBalance",
        "type": "int256"
      },
      {
        "internalType": "uint256",
        "name": "deposit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "owedDeposit",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "revokeSubscription",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "uint128",
        "name": "indexValue",
        "type": "uint128"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "updateIndex",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract ISuperfluidToken",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "indexId",
        "type": "uint32"
      },
      {
        "internalType": "address",
        "name": "subscriber",
        "type": "address"
      },
      {
        "internalType": "uint128",
        "name": "units",
        "type": "uint128"
      },
      {
        "internalType": "bytes",
        "name": "ctx",
        "type": "bytes"
      }
    ],
    "name": "updateSubscription",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "newCtx",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
let web3, usdcx, user, host, ida, drt;
let appAddress = "0xd76b685e4a025E173D5B420F368DdE70f4e40E41"; // Goerli - ETHx
// let appAddress = "0x65B09D9494A73F9a4da87de3475318738192F6C0"; // Kovan - aAAVEx

async function main() {
    await ethereum.enable();
    web3 = new Web3(ethereum);
    user = (await web3.eth.getAccounts())[0];
    setInterval(getBalance, 1000);
    const networkId = await web3.eth.net.getId();
    console.debug("networkId", networkId);

    const resolver = new web3.eth.Contract(
        res_abi,
        "0x3710AB3fDE2B61736B8BB0CE845D6c61F667a78E"); // Goerli
        // "0x851d3dd9dc97c1df1DA73467449B3893fc76D85B"); // Kovan
    console.debug("resolver", resolver._address);

    host = new web3.eth.Contract(
        sf_abi,
        "0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9"); // Goerli
        // "0xF0d7d1D47109bA426B9D8A3Cde1941327af1eea3"); // Kovan
    console.debug("host", host._address);

    // load agreements
    const idav1Type = web3.utils.sha3(
        "org.superfluid-finance.agreements.InstantDistributionAgreement.v1"
    );
    const idaAddress = await host.methods.getAgreementClass(idav1Type).call();
    ida = new web3.eth.Contract(
        ida_abi,
        "0xfDdcdac21D64B639546f3Ce2868C7EF06036990c"); // Goerli
        // "0x556ba0b3296027Dd7BCEb603aE53dEc3Ac283d2b"); // Kovan
    console.debug("ida", ida._address);

    // TODO: Refresh all Subscriptions
    await refreshSubscription("0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947"); // Goerli
    // await refreshSubscription("0x5a669e6A17B056Ca87e54c3Ca889114dB5A02590"); // Kovan

}


// TODO: Put this in a function and don't duplicate code, use a list and a loop
document.getElementById("approve-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947").addEventListener("click", function() {
    approve("0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947");
}, false);

document.getElementById("approve-0x5a669e6A17B056Ca87e54c3Ca889114dB5A02590").addEventListener("click", function() {
    approve("0x5a669e6A17B056Ca87e54c3Ca889114dB5A02590");
}, false);


document.getElementById("start-0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947").addEventListener("click", function() {
    startStream("0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947");
}, false);

document.getElementById("start-0x5a669e6A17B056Ca87e54c3Ca889114dB5A02590").addEventListener("click", function() {
    startStream("0x5a669e6A17B056Ca87e54c3Ca889114dB5A02590");
}, false);


async function approve(address) {
  // Get the address for approval
    await host.methods.callAgreement(
      "0xfDdcdac21D64B639546f3Ce2868C7EF06036990c", // Goerli
      // "0x556ba0b3296027Dd7BCEb603aE53dEc3Ac283d2b", // Kovan
        ida.methods.approveSubscription(
            address,
            appAddress,
            0,
            "0x"
        ).encodeABI(),
        "0x"
    ).send({ from: user });
    await refreshSubscription(address);
 }


async function refreshSubscription(address) {
   const sub = await ida.methods.getSubscription(
       address,
       appAddress,
       0,
       user
   ).call();
   console.log(sub);
   if (sub.approved) {
     let abtn = document.getElementById("approve-"+address)
     let sbtn = document.getElementById("start-"+address)
     let input = document.getElementById("input-amt-"+address)
     abtn.innerHTML = sub.approved ? "Approved" : "no";
     abtn.disabled = true;
     sbtn.disabled = false;
     input.disabled = false;
   }

}


async function startStream(address) {
   let input = document.getElementById("input-amt-"+address).value
   console.log("start streaming " + input + " USDCx/month");

   const user = host.user({
    address: walletAddress[0],
    token: address
  });
}



async function getBalance(tokenAddress) {
  // 1. HTTP requrest to API for balance
  let url = "http://localhost:5000/balance/" + user + "/0x5943F705aBb6834Cad767e6E4bB258Bc48D9C947";

  // TODO...
  // console.log(url)
  return fetch(url)
  .then(function (response) {
    return response.json();
  })
  .then(function (payload) {
    // console.log(payload.balance);
    document.getElementById("ETHxBalance").innerHTML = payload.balance;
  })
  .catch(function (error) {
    console.log("Error: " + error);
  });
  // $.getJSON( url, function( data ) {
  //   console.log(data)
  //   console.log("Get balance for " + user + " for token " + tokenAddress);
  // });


}



main();
