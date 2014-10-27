
//define the key ordering for level-sublevelq

//var join = '\x01', separate = '\x00'
//var join = '#', separate = '!'
var PATH_SEP = '/', SUBKEY_SEP = '#'


exports.encode = function (e) {
  return PATH_SEP + e[0].join(PATH_SEP) + SUBKEY_SEP + e[1]
}

exports.decode = function (s) {
  var i = s.indexOf(SUBKEY_SEP, 1)
  return [s.substring(1, i).split(PATH_SEP).filter(Boolean), s.substring(++i)]
}

exports.buffer = false

exports.lowerBound = '\x00'
exports.upperBound = '\xff'

exports.PATH_SEP = PATH_SEP
exports.SUBKEY_SEP = SUBKEY_SEP