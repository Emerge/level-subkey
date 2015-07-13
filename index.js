

var nut   = require('./src/DBCore')
var Subkey = require('./src/Subkey')
var precodec = require('./src/codec')
var codec = require('levelup-sync/lib/codec')
var merge = require('xtend')

var ReadStream  = require('levelup-sync/lib/read-stream')
var WriteStream = require("levelup-sync/lib/write-stream")

module.exports = function (db, opts) {
  opts = merge(db.options, opts)
  var subkey = Subkey(nut(db, precodec, codec), ReadStream, WriteStream)
  return subkey([], opts)
}
