require('dotenv').config();
var Web3 = require('web3');
var web3 = new Web3();
const truffle = require("truffle-contract");
const ZltoJSON = require("./zlto_truffle/build/contracts/Zlto.json");
const ZltoContract = truffle(ZltoJSON);

// const HDWalletProvider = require('truffle-hdwallet-provider');
// const mainnetProvider = new HDWalletProvider(
//     process.env.MNEMONIC,
//     `https://mainnet.infura.io/${process.env.INFURA_API_KEY}`
// );

async function contractAtAddress(addr) {
    const abi = ZltoJSON.abi;
    web3.setProvider(new Web3.providers.HttpProvider(`https://mainnet.infura.io/${process.env.INFURA_API_KEY}`))
    let contract = new web3.eth.Contract(abi, addr);
    return contract;
}

module.exports = {
    contractAtAddress,
    web3
};
