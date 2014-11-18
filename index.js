

var nut   = require('./nut')
var shell = require('./shell') //the shell surrounds the nut
var precodec = require('./codec')
var codec = require('levelup/lib/codec')
var merge = require('xtend')

var ReadStream  = require('levelup/lib/read-stream')
var WriteStream = require("levelup/lib/write-stream")

module.exports = function (db, opts) {
  opts = merge(db.options, opts)
  var subkey = shell(nut(db, precodec, codec), ReadStream, WriteStream)
  return subkey([], opts)
}
