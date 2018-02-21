'use strict';

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Clock = require('./lamport-clock');
var isDefined = require('./utils/is-defined');

var IpfsNotDefinedError = function IpfsNotDefinedError() {
  return new Error('Ipfs instance not defined');
};

var Entry = function () {
  function Entry() {
    (0, _classCallCheck3.default)(this, Entry);
  }

  (0, _createClass3.default)(Entry, null, [{
    key: 'create',

    /**
     * Create an Entry
     * @param {IPFS} ipfs - An IPFS instance
     * @param {string|Buffer|Object|Array} data - Data of the entry to be added. Can be any JSON.stringifyable data.
     * @param {Array<Entry|string>} [next=[]] Parents of the entry
     * @example
     * const entry = await Entry.create(ipfs, 'hello')
     * console.log(entry)
     * // { hash: "Qm...Foo", payload: "hello", next: [] }
     * @returns {Promise<Entry>}
     */
    value: async function create(ipfs, id, data) {
      var next = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var clock = arguments[4];
      var signKey = arguments[5];

      if (!isDefined(ipfs)) throw IpfsNotDefinedError();
      if (!isDefined(id)) throw new Error('Entry requires an id');
      if (!isDefined(data)) throw new Error('Entry requires data');
      if (!isDefined(next) || !Array.isArray(next)) throw new Error("'next' argument is not an array");

      // Clean the next objects and convert to hashes
      var toEntry = function toEntry(e) {
        return e.hash ? e.hash : e;
      };
      var nexts = next.filter(isDefined).map(toEntry);

      var entry = {
        hash: null, // "Qm...Foo", we'll set the hash after persisting the entry
        id: id, // For determining a unique chain
        payload: data, // Can be any JSON.stringifyable data
        next: nexts, // Array of Multihashes
        v: 0, // For future data structure updates, should currently always be 0
        clock: new Clock(id, clock ? clock.time : null)

        // If signing key was passedd, sign the enrty
      };if (ipfs.keystore && signKey) {
        entry = await Entry.signEntry(ipfs.keystore, entry, signKey);
      }

      entry.hash = await Entry.toMultihash(ipfs, entry);
      return entry;
    }
  }, {
    key: 'signEntry',
    value: async function signEntry(keystore, entry, key) {
      var signature = await keystore.sign(key, new Buffer((0, _stringify2.default)(entry)));
      entry.sig = signature;
      entry.key = key.getPublic('hex');
      return entry;
    }
  }, {
    key: 'verifyEntry',
    value: async function verifyEntry(entry, keystore) {
      var e = (0, _assign2.default)({}, {
        hash: null,
        id: entry.id,
        payload: entry.payload,
        next: entry.next,
        v: entry.v,
        clock: entry.clock
      });

      var pubKey = await keystore.importPublicKey(entry.key);
      await keystore.verify(entry.sig, pubKey, new Buffer((0, _stringify2.default)(e)));
    }

    /**
     * Get the multihash of an Entry
     * @param {IPFS} [ipfs] An IPFS instance
     * @param {Entry} [entry] Entry to get a multihash for
     * @example
     * const hash = await Entry.toMultihash(ipfs, entry)
     * console.log(hash)
     * // "Qm...Foo"
     * @returns {Promise<string>}
     */

  }, {
    key: 'toMultihash',
    value: function toMultihash(ipfs, entry) {
      if (!ipfs) throw IpfsNotDefinedError();
      var data = Buffer.from((0, _stringify2.default)(entry));
      return ipfs.object.put(data).then(function (res) {
        return res.toJSON().multihash;
      });
    }

    /**
     * Create an Entry from a multihash
     * @param {IPFS} [ipfs] An IPFS instance
     * @param {string} [hash] Multihash as Base58 encoded string to create an Entry from
     * @example
     * const hash = await Entry.fromMultihash(ipfs, "Qm...Foo")
     * console.log(hash)
     * // { hash: "Qm...Foo", payload: "hello", next: [] }
     * @returns {Promise<Entry>}
     */

  }, {
    key: 'fromMultihash',
    value: function fromMultihash(ipfs, hash) {
      if (!ipfs) throw IpfsNotDefinedError();
      if (!hash) throw new Error('Invalid hash: ' + hash);
      return ipfs.object.get(hash, { enc: 'base58' }).then(function (obj) {
        return JSON.parse(obj.toJSON().data);
      }).then(function (data) {
        var entry = {
          hash: hash,
          id: data.id,
          payload: data.payload,
          next: data.next,
          v: data.v,
          clock: data.clock
        };
        if (data.sig) (0, _assign2.default)(entry, { sig: data.sig });
        if (data.key) (0, _assign2.default)(entry, { key: data.key });
        return entry;
      });
    }

    /**
     * Check if an object is an Entry
     * @param {Entry} obj
     * @returns {boolean}
     */

  }, {
    key: 'isEntry',
    value: function isEntry(obj) {
      return obj.id !== undefined && obj.next !== undefined && obj.hash !== undefined && obj.payload !== undefined && obj.v !== undefined && obj.clock !== undefined;
    }
  }, {
    key: 'compare',
    value: function compare(a, b) {
      var distance = Clock.compare(a.clock, b.clock);
      if (distance === 0) return a.clock.id < b.clock.id ? -1 : 1;
      return distance;
    }

    /**
     * Check if an entry equals another entry
     * @param {Entry} a
     * @param {Entry} b
     * @returns {boolean}
     */

  }, {
    key: 'isEqual',
    value: function isEqual(a, b) {
      return a.hash === b.hash;
    }

    /**
     * Check if an entry is a parent to another entry.
     * @param {Entry} [entry1] Entry to check
     * @param {Entry} [entry2] Parent
     * @returns {boolean}
     */

  }, {
    key: 'isParent',
    value: function isParent(entry1, entry2) {
      return entry2.next.indexOf(entry1.hash) > -1;
    }

    /**
     * Find entry's children from an Array of entries
     *
     * @description
     * Returns entry's children as an Array up to the last know child.
     *
     * @param {Entry} [entry] Entry for which to find the parents
     * @param {Array<Entry>} [vaules] Entries to search parents from
     * @returns {Array<Entry>}
     */

  }, {
    key: 'findChildren',
    value: function findChildren(entry, values) {
      var stack = [];
      var parent = values.find(function (e) {
        return Entry.isParent(entry, e);
      });
      var prev = entry;
      while (parent) {
        stack.push(parent);
        prev = parent;
        parent = values.find(function (e) {
          return Entry.isParent(prev, e);
        });
      }
      stack = stack.sort(function (a, b) {
        return a.clock.time > a.clock.time;
      });
      return stack;
    }
  }]);
  return Entry;
}();

module.exports = Entry;