'use strict'

const pMap = require('p-map')
const Entry = require('./entry')
const EntryIO = require('./entry-io')
const Clock = require('./lamport-clock')
const LogError = require('./log-errors')
const isDefined = require('./utils/is-defined')
const _uniques = require('./utils/uniques')
const intersection = require('./utils/intersection')
const difference = require('./utils/difference')

const last = (arr, n) => arr.slice(arr.length - n, arr.length)

class LogIO {
  static toMultihash (immutabledb, log) {
    if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(log)) throw LogError.LogNotDefinedError()

    if (log.values.length < 1) throw new Error(`Can't serialize an empty log`)
    // return this._storage.put(this.toBuffer())
    return immutabledb.object.put(log.toBuffer())
      .then((dagNode) => dagNode.toJSON().multihash)
  }

  /**
   * Create a log from multihash
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string} hash - Multihash (as a Base58 encoded string) to create the log from
   * @param {Number} [length=-1] - How many items to include in the log
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static fromMultihash (immutabledb, hash, length = -1, exclude, onProgressCallback) {
    if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(hash)) throw new Error(`Invalid hash: ${hash}`)

    return immutabledb.object.get(hash, { enc: 'base58' })
      .then((dagNode) => JSON.parse(dagNode.toJSON().data))
    // return immutabledb.get(hash)
      .then((logData) => {
        if (!logData.heads || !logData.id) throw LogError.NotALogError()
        return EntryIO.fetchAll(immutabledb, logData.heads, length, exclude, null, onProgressCallback)
          .then((entries) => {
            // Find latest clock
            const clock = entries.reduce((clock, entry) => {
              if (entry.clock.time > clock.time) {
                return new Clock(entry.clock.id, entry.clock.time)
              }
              return clock
            }, new Clock(logData.id))
            const finalEntries = entries.slice().sort(Entry.compare)
            const heads = finalEntries.filter(e => logData.heads.includes(e.hash))
            return {
              id: logData.id,
              values: finalEntries,
              heads: heads,
              clock: clock,
            }
          })
      })
  }

  static fromEntryHash (ipfs, entryHash, id, length = -1, exclude, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.IpfsNotDefinedError()
    if (!isDefined(entryHash)) throw new Error("'entryHash' must be defined")

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, 1) : length

    // Make sure we pass hashes instead of objects to the fetcher function
    const excludeHashes = exclude// ? exclude.map(e => e.hash ? e.hash : e) : exclude

    return EntryIO.fetchParallel(ipfs, [entryHash], length, excludeHashes, null, null, onProgressCallback)
      .then((entries) => {
        // Cap the result at the right size by taking the last n entries,
        // or if given length is -1, then take all
        const sliced = length > -1 ? last(entries, length) : entries
        return {
          values: sliced,
        }
      })
  }

  static fromJSON (ipfs, json, length = -1, key, timeout, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()

    const mapper = (e, idx) => {
      return Entry.create(ipfs, keystore, e.id, e.payload, e.next, e.clock, e.key)
        .then((entry) => {
          if (onProgressCallback) onProgressCallback(entry.hash, entry, idx + 1, json.values.length)
          return entry
        })
    }

    return EntryIO.fetchParallel(ipfs, json.heads.map(e => e.hash), length, [], 16, timeout, onProgressCallback)
      .then((entries) => {
        const finalEntries = entries.slice().sort(Entry.compare)
        const heads = entries.filter(e => json.heads.includes(e.hash))
        return {
          id: json.id,
          values: finalEntries,
          heads: json.heads,
        }
      })
  }

  /**
   * Create a new log starting from an entry
   * @param {IPFS} ipfs An IPFS instance
   * @param {Array<Entry>} entries An entry or an array of entries to fetch a log from
   * @param {Number} [length=-1] How many entries to include. Default: infinite.
   * @param {Array<Entry|string>} [exclude] Entries to not fetch (cached)
   * @param {function(hash, entry, parent, depth)} [onProgressCallback]
   * @returns {Promise<Log>}
   */
  static fromEntry (immutabledb, sourceEntries, length = -1, exclude, key, keys, onProgressCallback) {
    if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined")

    // Make sure we only have Entry objects as input
    if (!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries)) {
      throw new Error(`'sourceEntries' argument must be an array of Entry instances or a single Entry`)
    }

    if (!Array.isArray(sourceEntries)) {
      sourceEntries = [sourceEntries]
    }

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, sourceEntries.length) : length

    // Make sure we pass hashes instead of objects to the fetcher function
    const excludeHashes = exclude ? exclude.map(e => e.hash ? e.hash : e) : exclude
    const hashes = sourceEntries.map(e => e.hash)

    return EntryIO.fetchParallel(immutabledb, hashes, length, excludeHashes, null, null, onProgressCallback)
      .then((entries) => {
        var combined = sourceEntries.concat(entries)
        var uniques = _uniques(combined, 'hash').sort(Entry.compare)

        // Cap the result at the right size by taking the last n entries
        const sliced = uniques.slice(length > -1 ? -length : -uniques.length)

        // Make sure that the given input entries are present in the result
        // in order to not lose references
        const missingSourceEntries = difference(sliced, sourceEntries, 'hash')

        const replaceInFront = (a, withEntries) => {
          var sliced = a.slice(withEntries.length, a.length)
          return withEntries.concat(sliced)
        }

        // Add the input entries at the beginning of the array and remove
        // as many elements from the array before inserting the original entries
        const result = replaceInFront(sliced, missingSourceEntries)
        return {
          id: result[result.length - 1].id,
          values: result,
        }
      })
  }

  /**
   * Expands the log with a specified number of new values
   *
   * @param  {[IPFS]} ipfs    [description]
   * @param  {[Log]} log     [description]
   * @param  {[Array<Entry>]} entries [description]
   * @param  {Number} amount  [description]
   * @return {[Log]}         [description]
   */
  static expandFrom (ipfs, log, entries, amount = -1) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (!isDefined(entries)) throw new Error(`'entries' must be given as argument`)

    if (!Array.isArray(entries)) {
      entries = [entries]
    }

    // Hashes of the next references, array per entry,
    // resulting an an array of arrays
    const hashes = entries.map(e => e.next).filter(e => e.length > 0)

    // If we don't have tails, we can't expand anymore, return
    if (hashes.length === 0) {
      return Promise.resolve({ values: log.values })
    }

    return EntryIO.fetchParallel(ipfs, hashes, amount, log.values)
      .then((entries) => {
        // Cap the length of the new collection (current length + wanted size)
        // const size = amount > -1 ? (log.length + amount) : -1
        const newEntries = log.merge(entries.slice(0, amount))

        return {
          values: newEntries,
        }
      })
  }

  static expand (ipfs, log, amount = -1) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(log)) throw LogError.LogNotDefinedError()

    // If we don't have any tails, we can't expand anymore
    if (log.tailHashes.length === 0) {
      return Promise.resolve({ values: log.values })
    }

    return EntryIO.fetchParallel(ipfs, log.tailHashes, amount, log.values)
      .then((entries) => {
        // Cap the length of the new collection (current length + wanted size)
        const size = amount > -1 ? (log.values.length + amount) : -1

        // Join the fetched entries with the log to order them first
        const combined = log.values.concat(entries).sort(Entry.compare)
        const sliced = (size > -1 ? combined.slice(-size) : combined.slice())

        // Because the clocks can vary drastically, we need to make sure that
        // we keep all the original entries in order to not lose references.
        // So we do the following:
        // 1) the old entries that are not in the sliced entries
        // 2) New entries without the old entries
        // 3) Entries that are in both

        // These together are the entries we need to put back in
        const missingOldEntries = difference(sliced, log.values, 'hash').sort(Entry.compare)
        const withoutOldEntries = difference(log.values, sliced, 'hash').sort(Entry.compare)
        const entryIntersection = intersection(log.values, sliced, 'hash').sort(Entry.compare)

        // Calculate how many entries we keep from the remaining new entries
        const length = size - (entryIntersection.length + missingOldEntries.length)
        const remainingNewEntries = length > -1 ? withoutOldEntries.slice(-length) : withoutOldEntries

        // Merge all the entries we want to keep
        const merge = (a, b) => {
          var combined = []
          combined = a.concat(b)
          var uniques = _uniques(combined, 'hash')
          return uniques.sort(Entry.compare)
        }

        const merged = merge(missingOldEntries, merge(entryIntersection, remainingNewEntries))
        return {
          values: merged,
        }
      })
  }

}

module.exports = LogIO
