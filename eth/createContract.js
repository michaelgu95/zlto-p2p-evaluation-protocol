var Web3 = require('web3');
var web3 = new Web3();
const truffle = require("truffle-contract");
const ZltoJSON = require("./zlto_truffle/build/contracts/Zlto.json");
const ZltoContract = truffle(ZltoJSON);

function createContract() {
  web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
  web3.eth.defaultAccount = web3.eth.accounts[0];

  ZltoContract.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

  let initializedContract;
  return ZltoContract.deployed().then(instance => {
    return instance;
  });
};

module.exports = {
  createContract
};
