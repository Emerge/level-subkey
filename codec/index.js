
//define the key ordering for level-sublevel

var PATH_SEP = '/', SUBKEY_SEP = '#'

//special key seperators
var SUBKEY_SEPS = '#.@'
var UNSAFE_CHARS =  SUBKEY_SEPS + '%'

function isString(s) {
  return "string" === typeof s
}

exports.__defineGetter__("SUBKEY_SEP", function() {
  return SUBKEY_SEP
})

exports.__defineGetter__("SUBKEY_SEPS", function() {
  return SUBKEY_SEPS
})

exports.__defineSetter__("SUBKEY_SEPS", function(value) {
    if (isString(value) && value.length) {
      SUBKEY_SEPS  = value
      SUBKEY_SEP   = SUBKEY_SEPS[0]
      UNSAFE_CHARS = SUBKEY_SEPS + '%'
    }
})



escapeString = exports.escapeString = function(aString, aUnSafeChars) {
  if (!isString(aString) || aString.length === 0) return aString
  var c, i, result, len;
  result = "";
  if (aUnSafeChars == null) {
    aUnSafeChars = UNSAFE_CHARS;
  }
  for (i = 0, len = aString.length; i < len; ++i) {
    c = aString[i];
    if (aUnSafeChars.indexOf(c) >= 0) {
      result += "%" + aString.charCodeAt(i).toString(16);
    } else {
      result += c;
    }
  }
  return result;
}

unescapeString = exports.unescapeString = decodeURIComponent

indexOfType = function(s) {
  var i = s.length-1
  while (i>0) {
    var c = s[i]
    if (SUBKEY_SEPS.indexOf(c) >=0) return i
    --i
  } //end while
  return -1
}

//the e is array[path, key, seperator]
//the seperator is optional
exports.encode = function (e) {
  var vSeperator = SUBKEY_SEP
  if (e.length >= 3 && e[2]) {
      vSeperator = e[2]
  }
  //console.log("encode:",PATH_SEP + e[0].join(PATH_SEP) + vSeperator + escapeString(e[1]))
  return PATH_SEP + e[0].join(PATH_SEP) + vSeperator + escapeString(e[1])
}

exports.decode = function (s) {
  var i = indexOfType(s)
  var vSep = s[i]
  if (vSep === SUBKEY_SEP) vSep = PATH_SEP
  return [s.substring(1, i).split(PATH_SEP).filter(Boolean), unescapeString(s.substring(i+1)), vSep]
}

exports.buffer = false

exports.lowerBound = '\x00'
exports.upperBound = '\uffff'
exports.PATH_SEP = PATH_SEP


