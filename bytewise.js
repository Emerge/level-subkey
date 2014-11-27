var nut   = require('./lib/DBCore')
var shell = require('./lib/Subkey') //the shell surrounds the nut
var codec = require('levelup/lib/codec')
var merge = require('xtend')

var ReadStream = require('levelup/lib/read-stream')

var precodec = require('./lib/codec/bytewise')

function id (e) {
  return e
}

module.exports = function (db, opts) {

  opts = merge(db.options, {
    keyEncoding: {
      encode: id,
      decode: id,
      buffer: true
    }
  }, opts)

  return shell (nut(db, precodec, codec), ReadStream)([], opts)

}


