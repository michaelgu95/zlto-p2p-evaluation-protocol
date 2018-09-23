var Web3 = require('web3');
var web3 = new Web3();
const truffle = require("truffle-contract");
const ZltoJSON = require("./zlto_truffle/build/contracts/Zlto.json");
const ZltoContract = truffle(ZltoJSON);

let secrets = require('./zlto_truffle/secrets');
const WalletProvider = require("truffle-wallet-provider");
const Wallet = require('ethereumjs-wallet');
let mainNetPrivateKey = new Buffer(secrets.mainnetPK, "hex");
let mainNetWallet = Wallet.fromPrivateKey(mainNetPrivateKey);
let mainNetProvider = new WalletProvider(mainNetWallet, "https://mainnet.infura.io/");
let ropstenPrivateKey = new Buffer(secrets.ropstenPK, "hex");
let ropstenWallet = Wallet.fromPrivateKey(ropstenPrivateKey);
let ropstenProvider = new WalletProvider(ropstenWallet,  "https://ropsten.infura.io/65492b8ee4c14ab59c69a249efcca589");


function createContract() {
  web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
  web3.eth.defaultAccount = web3.eth.accounts[0];

  ZltoContract.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

  let initializedContract;
  return ZltoContract.deployed().then(instance => {
    return instance;
  });
};

async function contractAtAddress(addr) {
    const abi = ZltoJSON.abi;
    web3.setProvider(ropstenProvider)
    let contract = new web3.eth.Contract(abi, addr);
    return contract;
}

module.exports = {
    createContract,
    contractAtAddress,
    web3
};
