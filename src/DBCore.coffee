xtend       = require('xtend')
util        = require('abstract-object/lib/util')
minimatch   = require('minimatch')
path        = require('./path')
hooks       = require('./hooks')
ltgt        = require('ltgt')
codec       = require('./codec')
PATH_SEP    = codec.PATH_SEP
SUBKEY_SEP  = codec.SUBKEY_SEP
Errors      = require("./errors")
WriteError  = Errors.WriteError
isFunction  = util.isFunction
isString    = util.isString
isObject    = util.isObject

isAlias =  (aKey) ->
  isString(aKey) && aKey.length > 0 && aKey[0] is PATH_SEP

pathArrayToPath = path.join
pathToPathArray = path.toArray

getPathArray = codec.getPathArray

resolveKeyPath = (aPathArray, aKey)->
  if isString(aKey) && aKey.length
      vPath = path.resolveArray(aPathArray, aKey)
      isAbsolutePath = vPath.shift(0,1)
      aKey = vPath.pop()
      [vPath, aKey]
  else
      [aPathArray, aKey]

has = (obj, name) -> Object.hasOwnProperty.call(obj, name)

clone = (_obj) ->
  obj = {}
  for k of _obj
    obj[k] = _obj[k]
  obj

#the DBCore is a singleton to extend the database's features to support the key path.
#all subkeys share the same one DBCore at backend.
exports = module.exports = (db) ->
  prehooks = hooks()
  posthooks = hooks()
  _subkeys = {}  #cache all subkey objects here.
  waiting = []; ready = false

  encodeKey   = codec.encodeKey
  decodeKey   = codec.decodeKey
  encodeValue = codec.encodeValue
  decodeValue = codec.decodeValue

  addEncodings = (op, aParent) ->
    if aParent && aParent.options
      op.keyEncoding =
        op.keyEncoding || aParent.options.keyEncoding
      op.valueEncoding =
        op.valueEncoding || aParent.options.valueEncoding
    op

  start = ->
    ready = true
    waiting.shift()() while waiting.length

  openDB = (cb) ->
    waiting.push(cb) if isFunction(cb)
    if isFunction(db.isOpen)
      if db.isOpen()
        ready = true
      else
        db.open(start)
    else
      db.open(start)
  openDB()

  return {
    _db: db
    isAlias: isAlias
    isOpen: ->
      db.isOpen() if db.isOpen #maybe it's a mock, so no isOpen()
    open: openDB,
    close: (cb) ->
      pre.removeAll()
      post.removeAll()
      _subkeys = {}
      db.close(cb)
    on: ->
      db.on.apply(db, arguments) if db.on
    once: ->
      db.once.apply(db, arguments) if db.once
    removeListener: ->
      db.removeListener.apply(db, arguments) if db.removeListener
    subkey: (aPath) ->
      aPath = path.resolve(aPath)
      _subkeys[aPath]
    subkeys: (aKeyPattern) ->
      result = {}
      if aKeyPattern
        for k of _subkeys
          result[k] = _subkeys[k] if minimatch(k, aKeyPattern)
      else
        result = _subkeys
      result
    createSubkey: (aKeyPathArray, aNewSubkeyProc, options, callback) ->
      vKeyPath = pathArrayToPath(aKeyPathArray)
      if options && options.forceCreate == true
        result = new aNewSubkeyProc(options, callback)
      else
        result = _subkeys[vKeyPath]
        if result
          result.addRef() if !options || options.addRef != false
          callback(null, result) if callback
        else
          result = new aNewSubkeyProc(options, callback)
          _subkeys[vKeyPath] = result
          result.on "destroyed", (item) ->
            delete _subkeys[vKeyPath]
      result
    delSubkey: (aKeyPath) -> delete _subkeys[aKeyPath]
    freeSubkey: (aKeyPathArray) ->
      vKeyPath = pathArrayToPath(aKeyPathArray)
      result = _subkeys[vKeyPath]
      if result
        result.free()
      else
        false
    apply: (ops, opts, cb) ->
      prepareKeyPath = (aOperation) ->
        vKey = aOperation.key
        if isString(vKey) && vKey.length
            vPath = path.resolveArray(aOperation.path, vKey)
            isAbsolutePath = vPath.shift(0,1)
            vKey = vPath.pop()
            if aOperation.separator && aOperation.separator != PATH_SEP
              vKey = aOperation.separator + vKey if vKey[0] != aOperation.separator
              aOperation.separator = undefined if vKey[0] is aOperation.separator
            aOperation._keyPath = [vPath, vKey]
            aOperation.path = vPath
            aOperation.key = vKey
        else
          aOperation._keyPath = [aOperation.path, vKey]
        return

      prepare = (aOperation) ->
        if aOperation.path
          addEncodings(aOperation, aOperation.path) #if aOperation.path is a sublevel object.
          aOperation.path = getPathArray(aOperation.path)
        prepareKeyPath(aOperation)
        delete aOperation.separator unless aOperation.separator
        return
      #apply prehooks here.
      i = 0
      while i < ops.length
        op = ops[i]
        prepare(op)
        if (op.triggerBefore isnt false)
          addOp = (aOperation) ->
            return delete ops[i] if aOperation is false
            aOperation.path = op.path unless aOperation.path
            prepare(aOperation)
            ops.push(aOperation)
            return
          prehooks.trigger op._keyPath, [op, addOp, ops]
        i++

      opts = opts || {}

      throw new WriteError('opts must be object, was:'+ opts)  if('object' != typeof opts)

      if('function' == typeof opts)
        cb = opts; opts = {}

      if ops.length
        (db.db || db).batch ops.map( (op) ->
            key: encodeKey(op._keyPath, xtend(opts, op))
            value: if op.type != 'del' then encodeValue(op.value,xtend(opts,op)) else undefined
            type: op.type || (if op.value == undefined then 'del' else 'put')
          ),
          opts,
          (err) ->
            return cb(err) if err
            ops.forEach (op) -> posthooks.trigger([op.path, op.key], [op]) if op.triggerAfter != false
            cb()
      else
        cb()
      return
    get: (key, aPath, opts, cb) ->
      getRedirect = (aDb, aKey, aOptions) ->
        console.log  'aKey=',aKey, aOptions.valueEncoding is "json"
        vNeedRedirect = aOptions.valueEncoding is "json" and isAlias(aKey)
        console.log  vNeedRedirect, aOptions.allowRedirect
        if aOptions.allowRedirect > 0 && vNeedRedirect
          aOptions.allowRedirect--
          aDb.get encodeKey(resolveKeyPath([], aKey), aOptions), aOptions, (err, value) ->
            if (err)
              cb(err)
            else
              vNeedRedirect = getRedirect(aDb, value, aOptions)
              switch vNeedRedirect
                when 1 # need Redirect, but Exceeded maximum redirect attempts
                  if aOptions.getRealKey is true
                    cb(new RedirectExceedError("Exceeded maximum redirect attempts"), value)
                  else
                    cb(null, value)
                when 0 # no need redirect
                  if aOptions.getRealKey is true
                    cb(null, aKey)
                  else
                    cb(null, decodeValue(value, aOptions))
              #switch(vNeedRedirect)
          # need redirect
          return 2
        else
          if (vNeedRedirect) then 1 else 0

      #opts.asBuffer = codec.isValueAsBuffer(opts)
      opts.asBuffer = false
      return (db.db || db).get(
        encodeKey(resolveKeyPath(aPath, key), opts),
        opts,
        (err, value) ->
          if err
            cb(err)
          else
            vOpts = opts || options
            if vOpts.getRealKey is true && not vOpts.allowRedirect?
              vOpts.allowRedirect = 6
            vNeedRedirect = getRedirect((db.db || db), value, vOpts)
            switch vNeedRedirect
              when 1
                if (vOpts.getRealKey is true)
                  cb(new RedirectExceedError("Exceeded maximum redirect attempts"), value)
                else
                  cb(null, value)
              when 0
                if (vOpts.getRealKey is true)
                  cb(null, path.resolve(aPath, key))
                else
                  cb(null, codec.decodeValue(value, vOpts))
      )
    pre: prehooks.add
    post: posthooks.add
    createDecoder: (opts) ->
      makeData = (key, value) ->
        result = {}
        if key
          key = decodeKey(key, opts)
          if isObject(key)
            result.key = key.key
            result.separator = key.separator
          else
            result.key = key
        result.value = decodeValue(value, opts) if value
        result

      if opts.keys isnt false && opts.values isnt false
        return (key, value) ->
          result =
            key: decodeKey(key, opts)
            value: decodeValue(value, opts)
          if opts.absoluteKey isnt true
            result.path = pathArrayToPath(opts.path)
          result
      if opts.values isnt false
        return (_, value) -> decodeValue(value, opts)
      if opts.keys isnt false
        return (key) -> decodeKey(key, opts)
      return ->

    iterator: (_opts) ->
      opts = clone(_opts || {})
      vPath = opts.path || []

      #the key is lowerBound or upperBound.
      #if opts.start is exists then lowBound key is opt.start
      encodeKeyPath = (key) ->
        encodeKey(resolveKeyPath(vPath, key), xtend(opts, {keyEncoding: false, encoding: false}))

      #convert the lower/upper bounds to real lower/upper bounds.
      #precodec.lowerBound, precodec.upperBound are default bounds in case of the opts have no bounds.
      ltgt.toLtgt(opts, opts, encodeKeyPath, codec.lowerBound, codec.upperBound) if opts.bounded isnt false

      #because the ltgt.toLtgt will encode the lt/lte,gt/gte
      #I need make the 'next' as decoded key, not raw key!!
      if opts.next
          if opts.reverse isnt true
            opts.gt = opts.next
            opts.gte= opts.next
          else
            opts.lt = opts.next
            opts.lte= opts.next

      #************************************************
      #hard coded defaults, for now...
      #TODO: pull defaults and encoding out of levelup.
      opts.keyAsBuffer = opts.valueAsBuffer = false
      #************************************************


      #this is vital, otherwise limit: undefined will
      #create an empty stream.
      opts.limit = -1 if 'number' isnt typeof opts.limit

      #opts.keyAsBuffer = codec.buffer
      #opts.valueAsBuffer = codec.isValueAsBuffer(opts)
      #console.log("it:opts:", opts)

      result = (db.db || db).iterator(opts)
      result
  }

exports.getPathArray    = getPathArray
exports.pathArrayToPath = pathArrayToPath
exports.pathToPathArray = pathToPathArray
exports.resolveKeyPath  = resolveKeyPath
exports.FILTER_INCLUDED =  0
exports.FILTER_EXCLUDED =  1
exports.FILTER_STOPPED  = -1

