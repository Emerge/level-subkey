var path = require('path')
var hooks = require('./hooks')
var ltgt = require('ltgt')
var PATH_SEP = require('./codec').PATH_SEP

function isFunction (f) {
  return 'function' === typeof f
}

function isString (f) {
  return 'string' === typeof f
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
  if(isString(aPath) && aPath.length) return pathToPathArray(aPath)
  //is a path array:
  return aPath
}

function resolveKeyPath(aPathArray, aKey) {
    if (isString(aKey) && aKey.length) {
        var vPath = pathArrayToPath(aPathArray)
        vPath = path.resolve(vPath, aKey)
        aKey = path.basename(vPath)
        vPath = path.dirname(vPath)
        return [pathToPathArray(vPath), aKey]
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
  function encodePath(aKeyPath, opts1, opts2) {
    return precodec.encode([ aKeyPath[0], codec.encodeKey(aKeyPath[1], opts1, opts2 ) ])
  }

  function decodePath(data) {
    return precodec.decode(data)
  }

  function decodeKeyWithOptions(key, opts) {
      //v=[parent, key]
      v = precodec.decode(key)
      key = codec.decodeKey(v[1], opts);
      if (opts.absoluteKey) {
          key = path.join(pathArrayToPath(v[0]), key)
      }
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

  if(isFunction(db.isOpen)) {
    if(db.isOpen())
      ready = true
    else
      db.open(start)
  } else {
    db.open(start)
  }

  return {
    apply: function (ops, opts, cb) {
      //apply prehooks here.
      for(var i = 0; i < ops.length; i++) {
        var op = ops[i]
        addEncodings(op, op.path) //if op.path is a sublevel object.
        op.path = getPathArray(op.path)
        op._realKeyPath = resolveKeyPath(op.path, op.key)
        prehooks.trigger(op._realKeyPath, [op, add, ops])

        function add(op) {
          if(op === false) return delete ops[i]
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
              key: encodePath(op._realKeyPath, opts, op),
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
      function encodeKey(key) {
        return encodePath([vPath, key], opts, {})
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
exports.resolveKeyPath = resolveKeyPath
