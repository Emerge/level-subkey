

var nut   = require('./lib/DBCore')
var Subkey = require('./lib/Subkey')
var precodec = require('./lib/codec')
var codec = require('levelup-sync/lib/codec')
var merge = require('xtend')

var ReadStream  = require('nosql-stream/lib/read-stream')
var WriteStream = require("nosql-stream/lib/write-stream")

module.exports = function (db, opts) {
  opts = merge(db.options, opts)
  var subkey = Subkey(nut(db, precodec, codec), ReadStream, WriteStream)
  return subkey([], opts)
}
