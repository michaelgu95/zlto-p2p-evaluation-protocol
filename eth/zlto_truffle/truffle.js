// Allows us to use ES6 in our migrations and tests.
require('babel-register')

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*' // Match any network id
    },
  	"live": {
      network_id: 1,
      host: "127.0.0.1",
      port: 8546   // Different than the default below
    }
  }
}
