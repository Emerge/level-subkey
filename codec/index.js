
//define the key ordering for level-sublevel

//special key seperators
var SUBKEY_SEPS = ['/.@', '#!^']
var UNSAFE_CHARS =  SUBKEY_SEPS[0] + SUBKEY_SEPS[1] + '%'
var PATH_SEP = SUBKEY_SEPS[0][0], SUBKEY_SEP = SUBKEY_SEPS[1][0]


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
    if (Array.isArray(value) && value.length>=2 && isString(value[0]) && isString(value[1]) && value[0].length>0 && value[0].length===value[1].length) {
      SUBKEY_SEPS  = value
      PATH_SEP     = SUBKEY_SEPS[0][0]
      SUBKEY_SEP   = SUBKEY_SEPS[1][0]
      UNSAFE_CHARS = SUBKEY_SEPS[0] + SUBKEY_SEPS[1] + '%'
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
    if (SUBKEY_SEPS[1].indexOf(c) >=0) return i
    --i
  } //end while
  return -1
}

//the e is array[path, key, seperator]
//the seperator is optional
exports.encode = function (e) {
  var i
  var vSeperator = SUBKEY_SEP
  var hasSep = e.length >= 3 && e[2]
  var key = e[1], isStrKey = isString(key) && key.length !== 0
  if (hasSep) {
      vSeperator = e[2]
      i = SUBKEY_SEPS[0].indexOf(vSeperator, 1)
      if (i > 0)
        vSeperator = PATH_SEP + SUBKEY_SEPS[1][i]
      else
        vSeperator = PATH_SEP + vSeperator
  } else if (isStrKey){
      //try to find the separator on the key
      i = SUBKEY_SEPS[0].indexOf(key[0], 1)
      if (i > 0) {
          vSeperator = PATH_SEP + SUBKEY_SEPS[1][i]
          key = key.substring(1)
      }
  }
  if (isStrKey) {
      if (hasSep && key[0] === e[2]) key = key.substring(1)
      key = escapeString(key)
  }
  //console.log("codec.encode:",PATH_SEP + e[0].join(PATH_SEP) + vSeperator + key)
  return PATH_SEP + e[0].join(PATH_SEP) + vSeperator + key
}

//return [path, key, separator, realSeparator]
//the realSeparator is optional, only (aSeparator && aSeparator !== seperator
exports.decode = function (s, aSeparator) {
  var result
  var i = indexOfType(s)
  if (i>=0) {
      var vSep = s[i]
      if (vSep === SUBKEY_SEP) {
          vSep = PATH_SEP
      } else {
          var j = SUBKEY_SEPS[1].indexOf(vSep)
          vSep = PATH_SEP + SUBKEY_SEPS[0][j]
      }
      var vKey = unescapeString(s.substring(i+1))
      result = [s.substring(1, i).split(PATH_SEP).filter(Boolean).map(unescapeString), vKey, vSep]
      if (isString(aSeparator) && aSeparator !== s[i]) result.push(s[i])
  }
  return result
}

exports.buffer = false

exports.lowerBound = '\x00'
exports.upperBound = '\uffff'
exports.PATH_SEP = PATH_SEP


