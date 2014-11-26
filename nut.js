var minimatch   = require('minimatch')
var path        = require('./path')
var hooks       = require('./hooks')
var ltgt        = require('ltgt')
var precodec    = require('./codec')
var PATH_SEP    = precodec.PATH_SEP
var SUBKEY_SEP  = precodec.SUBKEY_SEP
var Errors      = require("./errors")

WriteError     = Errors.WriteError

function isFunction (f) {
  return 'function' === typeof f
}

function isString (f) {
  return 'string' === typeof f
}

function isObject (f) {
  return f && 'object' === typeof f
}

function isAlias(aKey) {
  return isString(aKey) && aKey.length > 0 && aKey[0] === PATH_SEP
}
function pathArrayToPath(aPath) {
    return path.join(aPath)
}

function pathToPathArray(aPath) {
    while (aPath.length && aPath[0] == PATH_SEP) aPath = aPath.substring(1)
    while (aPath.length && aPath[aPath.length-1] == PATH_SEP) aPath = aPath.substring(0, aPath.length-1)
    if (aPath.length)
        return aPath.split(PATH_SEP)
    else
        return []
}

function getPathArray (aPath, aParentPath) {
  if(aPath == null) return aPath
  //is a sublevel object?
  if(isFunction(aPath.pathAsArray)) return aPath.pathAsArray()
  if(isString(aPath)) {
      var result
      if (aParentPath) {
          result = path.resolveArray(aParentPath, aPath)
          result.shift(0,1)
      }
      else result = pathToPathArray(aPath)
      return result
  }
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

//the nut is a singleton for enhance the levelup's features to support the key path.
//all subkeys share the same one nut at backend.
exports = module.exports = function (db, precodec, codec) {
  var prehooks = hooks()
  var posthooks = hooks()
  var _subkeys = {}  //cache all subkey objects here.
  var waiting = [], ready = false

  //aKeyPath=[path, key]
  function encodePath(aKeyPath, opts, op) {
    var vSep = (op && op.separator) || (opts && opts.separator)
    var vSepRaw = (op && op.separatorRaw) || (opts && opts.separatorRaw)
    return precodec.encode([ aKeyPath[0], codec.encodeKey(aKeyPath[1], opts, op ), vSep, vSepRaw])
  }

  function decodePath(data) {
    return precodec.decode(data)
  }

  function decodeKeyWithOptions(key, opts) {
      //v=[parent, key, separator, realSeparator]
      //realSeparator is optional only opts.separator && opts.separator != realSeparator
      var v = precodec.decode(key, opts.separator)
      var vSep = v[2] //separator
      if (vSep === undefined) vSep = PATH_SEP  //if the precodec is other codec.
      key = codec.decodeKey(v[1], opts);
      if (opts.absoluteKey) {
          key = pathArrayToPath(v[0]) + vSep + key
      } else if (opts.path && isString(key) && key != "") {
          var vPath = path.relative(opts.path, v[0])
          if (vPath == "" && vSep === PATH_SEP) vSep = ""
          else if (vSep.length >= 2) vSep = vSep.substring(1)
          key = vPath + vSep + key
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
    _db: db,
    isAlias: isAlias,
    isOpen: function(){
        if (db.isOpen) { //maybe it's a mock, so no isOpen()
          var result = db.isOpen()
          return result
        }
    },
    open: openDB,
    close: function(cb) {
        pre.removeAll()
        post.removeAll()
        _subkeys = {}
        return db.close(cb)
    },
    on: function() {
        if (db.on) db.on.apply(db, arguments)
    },
    once: function() {
        if (db.once) db.once.apply(db, arguments)
    },
    removeListener: function() {
        if (db.removeListener) db.removeListener.apply(db, arguments)
    },
    subkey: function(aPath) {
      aPath = path.resolve(aPath)
      return _subkeys[aPath]
    },
    subkeys: function(aKeyPattern) {
        var result = {}
        if (aKeyPattern) {
            for (var k in _subkeys) {
                if (minimatch(k, aKeyPattern)) result[k] = _subkeys[k]
            }
        } else
            result = _subkeys
        return result
    },
    createSubkey: function(aKeyPathArray, aNewSubkeyProc, options, callback) {
        var vKeyPath = pathArrayToPath(aKeyPathArray)
        var result;
        if (options && options.forceCreate === true) {
          result = new aNewSubkeyProc(options, callback)
        } else {
          result = _subkeys[vKeyPath]
          if (result) {
              if (!options || options.addRef !== false) result.addRef()
              if (callback) {
                callback(null, result)
              }
          } else {
              result = new aNewSubkeyProc(options, callback)
              _subkeys[vKeyPath] = result
              result.on("destroyed", function(item){
                delete _subkeys[vKeyPath]
              })
          }
        }
        return result
    },
    delSubkey: function(aKeyPath) {
      return delete _subkeys[aKeyPath]
    },
    freeSubkey: function(aKeyPathArray) {
        var vKeyPath = pathArrayToPath(aKeyPathArray)
        var result = _subkeys[vKeyPath]
        if (result) {
          return result.free()
        } else
          return false
    },
    apply: function (ops, opts, cb) {
      function prepareKeyPath(aOperation) {
        var vKey = aOperation.key
        if (isString(vKey) && vKey.length) {
            var vPath = path.resolveArray(aOperation.path, vKey)
            var isAbsolutePath = vPath.shift(0,1)
            vKey = vPath.pop()
            if (aOperation.separator && aOperation.separator !== PATH_SEP)
            {
              if (vKey[0] !== aOperation.separator) {
                vKey = aOperation.separator + vKey
              }
              if (vKey[0] === aOperation.separator) {
                aOperation.separator = undefined
              }
            }
            aOperation._keyPath = [vPath, vKey]
            aOperation.path = vPath
            aOperation.key = vKey
        }
        else
         aOperation._keyPath = [aOperation.path, vKey]
      }
      function prepare(aOperation) {
        if (aOperation.path) {
          addEncodings(aOperation, aOperation.path) //if aOperation.path is a sublevel object.
          aOperation.path = getPathArray(aOperation.path)
        }
        prepareKeyPath(aOperation)
        if (!aOperation.separator) delete aOperation.separator
      }
      //apply prehooks here.
      for(var i = 0; i < ops.length; i++) {
        var op = ops[i]
        prepare(op)
        if (op.triggerBefore !== false) prehooks.trigger(op._keyPath, [op, add, ops])
        function add(aOperation) {
          if(aOperation === false) return delete ops[i]
          if (!aOperation.path) aOperation.path = op.path
          prepare(aOperation)
          ops.push(aOperation)
        }
      }

      opts = opts || {}

      if('object' !== typeof opts) throw new WriteError('opts must be object, was:'+ opts) 

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
              if (op.triggerAfter !== false) posthooks.trigger([op.path, op.key], [op])
            })
            cb()
          }
        )
      else
        cb()
    },
    get: function (key, aPath, opts, cb) {
      function getRedirect(aDb, aKey, aOptions) {
        var vNeedRedirect = aOptions.valueEncoding === "json" && isAlias(aKey)
        if (aOptions.allowRedirect > 0 && vNeedRedirect) {
          aOptions.allowRedirect--
          aDb.get(encodePath(resolveKeyPath([], aKey), aOptions), aOptions, function(err, value) {
            if (err) cb(err)
            else {
              vNeedRedirect = getRedirect(aDb, value, aOptions)
              switch (vNeedRedirect) {
                case 1:
                  if (aOptions.getRealKey === true)
                    cb(new RedirectExceedError("Exceeded maximum redirect attempts"), value)
                  else
                    cb(null, value)
                  break
                case 0:
                  if (aOptions.getRealKey === true) {
                    cb(null, aKey)
                  } else {
                    cb(null, codec.decodeValue(value, aOptions))
                  }
                  break
              } //switch(vNeedRedirect)
            }
          })
          return 2
        } else {
          if (vNeedRedirect) return 1
          else return 0
        }
      }
      opts.asBuffer = codec.isValueAsBuffer(opts)
      return (db.db || db).get(
        encodePath(resolveKeyPath(aPath, key), opts),
        opts,
        function (err, value) {
          if(err) cb(err)
          else {
            var vOpts = opts || options
            if (vOpts.getRealKey === true && vOpts.allowRedirect == null)
              vOpts.allowRedirect = 6
            var vNeedRedirect = getRedirect((db.db || db), value, vOpts)
            switch (vNeedRedirect) {
              case 1:
                if (vOpts.getRealKey === true)
                  cb(new RedirectExceedError("Exceeded maximum redirect attempts"), value)
                else
                  cb(null, value)
                break
              case 0:
                if (vOpts.getRealKey === true)
                  cb(null, path.resolve(aPath, key))
                else {
                  cb(null, codec.decodeValue(value, vOpts))
                }
                break
            }
          }
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
          var result = {
              key: decodeKeyWithOptions(key, opts),
              value: codec.decodeValue(value, opts)
          }
          if (opts.absoluteKey !== true) {
              result.path = pathArrayToPath(opts.path)
          }
          return result
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

      if (opts.bounded !== false) {
        //convert the lower/upper bounds to real lower/upper bounds.
        //precodec.lowerBound, precodec.upperBound are default bounds in case of the opts have no bounds.
        ltgt.toLtgt(opts, opts, encodeKey, precodec.lowerBound, precodec.upperBound)
      }
      if (opts.next) {
          if (opts.reverse !== true) {
            opts.gt = opts.next
            opts.gte= opts.next
          }
          else {
            opts.lt = opts.next
            opts.lte= opts.next
        }
      }
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
      //console.log("it:opts:", opts)

      function wrapIterator (iterator) {
        return {
          // cb(err, key, value): halt when key && value are both undefined
          next: function (cb) {
              var self = this
              return iterator.next(function(err, key, value){
                  if (!err && (key !== undefined || value !== undefined)) {
                    self.last = key
                  }
                  return cb(err, key, value)
              })
          },
          end: function (cb) {
            var self = this
            iterator.end(function(){
                self.stream.emit("last", self.last)
                cb()
            })
          }
        }
      }
      if(ready) {
        var result = wrapIterator((db.db || db).iterator(opts))
        cb(null, result)
        return result
      }
      else {
        waiting.push(function () {
          cb(null, wrapIterator((db.db || db).iterator(opts)))
        })
      }

    }
  }

}

exports.getPathArray    = getPathArray
exports.pathArrayToPath = pathArrayToPath
exports.pathToPathArray = pathToPathArray
exports.resolveKeyPath  = resolveKeyPath
exports.FILTER_INCLUDED =  0
exports.FILTER_EXCLUDED =  1
exports.FILTER_STOPPED  = -1

