var path = require('./path')
var hooks = require('./hooks')
var ltgt = require('ltgt')
var precodec = require('./codec')
var PATH_SEP = precodec.PATH_SEP
var SUBKEY_SEP = precodec.SUBKEY_SEP

function isFunction (f) {
  return 'function' === typeof f
}

function isString (f) {
  return 'string' === typeof f
}

function isObject (f) {
  return f && 'object' === typeof f
}

function pathArrayToPath(aPath) {
    return PATH_SEP + aPath.join(PATH_SEP)
}

function pathToPathArray(aPath) {
    while (aPath.length && aPath[0] == PATH_SEP) aPath = aPath.substring(1)
    while (aPath.length && aPath[aPath.length-1] == PATH_SEP) aPath = aPath.substring(0, aPath.length-1)
    if (aPath.length)
        return aPath.split(PATH_SEP)
    else
        return []
}

function getPathArray (aPath) {
  if(aPath == null) return aPath
  //is a sublevel object?
  if(isFunction(aPath.pathAsArray)) return aPath.pathAsArray()
  if(isString(aPath)) return pathToPathArray(aPath)
  //is a path array:
  return aPath
}

function resolveKeyPath(aPathArray, aKey) {
    if (isString(aKey) && aKey.length) {
        //var vPath = pathArrayToPath(aPathArray)
        var vPath = path.resolveArray(aPathArray, aKey)
        var isAbsolutePath = vPath.shift(0,1)
        aKey = vPath.pop()
        return [vPath, aKey]
    }
    else
        return [aPathArray, aKey]
}

function has(obj, name) {
  return Object.hasOwnProperty.call(obj, name)
}

function clone (_obj) {
  var obj = {}
  for(var k in _obj)
    obj[k] = _obj[k]
  return obj
}

exports = module.exports = function (db, precodec, codec) {
  var prehooks = hooks()
  var posthooks = hooks()
  var waiting = [], ready = false

  //aKeyPath=[path, key]
  function encodePath(aKeyPath, opts, op) {
    var vSep = (op && op.separator) || (opts && opts.separator)
    return precodec.encode([ aKeyPath[0], codec.encodeKey(aKeyPath[1], opts, op ), vSep])
  }

  function decodePath(data) {
    return precodec.decode(data)
  }

  function decodeKeyWithOptions(key, opts) {
      //v=[parent, key, separator, realSeparator]
      //realSeparator is optional only opts.separator && opts.separator != realSeparator
      var v = precodec.decode(key, opts.separator)
      var vSep = v[2]
      if (vSep === undefined) vSep = PATH_SEP  //if the precodec is other codec.
      key = codec.decodeKey(v[1], opts);
      if (opts.absoluteKey) {
          key = pathArrayToPath(v[0]) + vSep + key
      } else if (opts.path && isString(key) && key != "") {
          key = path.relative(pathArrayToPath(opts.path), pathArrayToPath(v[0]) + vSep + key)
      }
      /*
      if (opts.separator && v.length >= 4) {
          key = {key: key, separator: v[3]}
      }*/
      return key
  }
  function addEncodings(op, aParent) {
    if(aParent && aParent.options) {
      op.keyEncoding =
        op.keyEncoding || aParent.options.keyEncoding
      op.valueEncoding =
        op.valueEncoding || aParent.options.valueEncoding
    }
    return op
  }

  function start () {
    ready = true
    while(waiting.length)
      waiting.shift()()
  }

  function openDB(cb) {
      if (isFunction(cb)) waiting.push(cb)
      if(isFunction(db.isOpen)) {
        if(db.isOpen())
          ready = true
        else
          db.open(start)
      } else {
        db.open(start)
      }
  }
  openDB()

  return {
    isOpen: function(){
        var result = db.isOpen()
        return result
    },
    open: openDB,
    close: function(cb) {
        return db.close(cb)
    },
    on: function() {
        db.on.appy(db)
    },
    once: function() {
        db.once.apply(db)
    },
    apply: function (ops, opts, cb) {
      //apply prehooks here.
      for(var i = 0; i < ops.length; i++) {
        var op = ops[i]
        addEncodings(op, op.path) //if op.path is a sublevel object.
        op.path = getPathArray(op.path)
        op._keyPath = resolveKeyPath(op.path, op.key)
        prehooks.trigger(op._keyPath, [op, add, ops])
        function add(op) {
          if(op === false) return delete ops[i]
          op._keyPath = resolveKeyPath(op.path, op.key)
          ops.push(op)
        }
      }

      opts = opts || {}

      if('object' !== typeof opts) throw new Error('opts must be object, was:'+ opts) 

      if('function' === typeof opts) cb = opts, opts = {}

      if(ops.length)
        (db.db || db).batch(
          ops.map(function (op) {
            return {
              key: encodePath(op._keyPath, opts, op),
              value:
                  op.type !== 'del'
                ? codec.encodeValue(
                    op.value,
                    opts,
                    op
                  )
                : undefined,
              type:
                op.type || (op.value === undefined ? 'del' : 'put')
            }
          }),
          opts,
          function (err) {
              if(err) return cb(err)
            ops.forEach(function (op) {
              posthooks.trigger([op.path, op.key], [op])
            })
            cb()
          }
        )
      else
        cb()
    },
    get: function (key, path, opts, cb) {
      opts.asBuffer = codec.isValueAsBuffer(opts)
      return (db.db || db).get(
        encodePath(resolveKeyPath(path, key), opts),
        opts,
        function (err, value) {
          if(err) cb(err)
          else    cb(null, codec.decodeValue(value, opts || options))
        }
      )
    },
    pre: prehooks.add,
    post: posthooks.add,
    createDecoder: function (opts) {
      function makeData(key, value) {
          result = {}
          if (key) {
              key = decodeKeyWithOptions(key, opts)
              if (isObject(key)) {
                  result.key = key.key
                  result.separator = key.separator
              } else {
                  result.key = key
              }
          }
          if (value) result.value = codec.decodeValue(value, opts)
          return result
      }
      if(opts.keys !== false && opts.values !== false)
        return function (key, value) {
          return {
              key: decodeKeyWithOptions(key, opts),
              value: codec.decodeValue(value, opts)
          }
        }
      if(opts.values !== false)
        return function (_, value) {
          return codec.decodeValue(value, opts)
        }
      if(opts.keys !== false)
        return function (key) {
          return decodeKeyWithOptions(key, opts)
        }
      return function () {}
    },
    iterator: function (_opts, cb) {
      var opts = clone(_opts || {})
      var vPath = opts.path || []

      //the key is lowerBound or upperBound.
      //if opts.start is exists then lowBound key is opt.start
      function encodeKey(key) {
        return encodePath(resolveKeyPath(vPath, key), opts, {})
      }

      ltgt.toLtgt(opts, opts, encodeKey, precodec.lowerBound, precodec.upperBound)

      //opts.path = null

      //************************************************
      //hard coded defaults, for now...
      //TODO: pull defaults and encoding out of levelup.
      opts.keyAsBuffer = opts.valueAsBuffer = false
      //************************************************


      //this is vital, otherwise limit: undefined will
      //create an empty stream.
      if ('number' !== typeof opts.limit)
        opts.limit = -1

      opts.keyAsBuffer = precodec.buffer
      opts.valueAsBuffer = codec.isValueAsBuffer(opts)

      function wrapIterator (iterator) {
        return {
          next: function (cb) {
            return iterator.next(cb)
          },
          end: function (cb) {
            iterator.end(cb)
          }
        }
      }

      if(ready)
        return wrapIterator((db.db || db).iterator(opts))
      else
        waiting.push(function () {
          cb(null, wrapIterator((db.db || db).iterator(opts)))
        })

    }
  }

}

exports.getPathArray = getPathArray
exports.pathArrayToPath = pathArrayToPath
exports.pathToPathArray = pathToPathArray
exports.resolveKeyPath = resolveKeyPath
exports.FILTER_INCLUDED =  0
exports.FILTER_EXCLUDED =  1
exports.FILTER_STOPPED  = -1