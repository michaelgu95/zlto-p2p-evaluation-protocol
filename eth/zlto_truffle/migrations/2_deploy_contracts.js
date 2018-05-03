// var ConvertLib = artifacts.require("./ConvertLib.sol");
// var MetaCoin = artifacts.require("./MetaCoin.sol");
var Zlto = artifacts.require("./Zlto.sol");

module.exports = function(deployer) {
  deployer.deploy(Zlto);
  // deployer.link(ConvertLib, MetaCoin);
  // deployer.deploy(MetaCoin);
};
