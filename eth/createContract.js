var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
web3.eth.defaultAccount = web3.eth.accounts[0];

const abi = [
  {
    "constant": false,
    "inputs": [
      {
        "name": "id",
        "type": "uint256"
      },
      {
        "name": "documentHash",
        "type": "bytes32"
      }
    ],
    "name": "notarizeHash",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "documentHash",
        "type": "bytes32"
      }
    ],
    "name": "ProofCreated",
    "type": "event"
  },
  {
    "inputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "id",
        "type": "uint256"
      },
      {
        "name": "documentHash",
        "type": "bytes32"
      }
    ],
    "name": "doesProofExist",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];   

const contractInterface = web3.eth.contract(abi);
const initializedContract = contractInterface.at('0x43642b9100d5e85c3f6468c968881b2c340605ea');

module.exports = {
  contract: initializedContract
};

