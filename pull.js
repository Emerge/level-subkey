
var pull = null
try {
  pull = require('pull-stream')
}
catch(e) {
  console.error("`npm install pull-stream` first to use.")
  throw e
}
// Currently this uses pull streams,
// and not levelup's readstream, but in theory
// I should be able pretty much just drop that in.

module.exports = function pullReadStream (options, makeData) {
  var stream = pull.defer()

  stream.setIterator = function (iterator) {
    stream.resolve(function (end, cb) {
      if(!end) iterator.next(function (err, key, value) {
                if(err) return cb(err)
                if(key === undefined || value === undefined)
                        return cb(true)
                cb(null, makeData(key, value))
      })
      else
        iterator.end(cb)
    })
  }

  return stream
}
