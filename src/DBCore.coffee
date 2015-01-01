util        = require("abstract-object/lib/util")
minimatch   = require('minimatch')
path        = require('./path')
hooks       = require('./hooks')
ltgt        = require('ltgt')
precodec    = require('./codec')
PATH_SEP    = precodec.PATH_SEP
SUBKEY_SEP  = precodec.SUBKEY_SEP
Errors      = require("./errors")
WriteError  = Errors.WriteError
isFunction  = util.isFunction
isString    = util.isString
isObject    = util.isObject

isAlias =  (aKey) ->
  isString(aKey) && aKey.length > 0 && aKey[0] is PATH_SEP

pathArrayToPath = path.join

pathToPathArray = (aPath) ->
  aPath = aPath.substring(1) while (aPath.length && aPath[0] == PATH_SEP) 
  aPath = aPath.substring(0, aPath.length-1) while (aPath.length && aPath[aPath.length-1] == PATH_SEP) 
  if (aPath.length)
    aPath.split(PATH_SEP)
  else
    []

getPathArray = (aPath, aParentPath) ->
  return aPath unless aPath?
  #is a subkey object?
  return aPath.pathAsArray() if isFunction(aPath.pathAsArray)
  if isString(aPath)
    if aParentPath
      aPath = path.resolveArray(aParentPath, aPath)
      aPath.shift(0,1)
    else aPath = pathToPathArray(aPath)
  #is a path array:
  aPath

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
exports = module.exports = (db, precodec, codec) ->
  prehooks = hooks()
  posthooks = hooks()
  _subkeys = {}  #cache all subkey objects here.
  waiting = []; ready = false

  #aKeyPath=[path, key]
  encodePath = (aKeyPath, opts, op) ->
    vSep = (op && op.separator) || (opts && opts.separator)
    vSepRaw = (op && op.separatorRaw) || (opts && opts.separatorRaw)
    return precodec.encode([ aKeyPath[0], codec.encodeKey(aKeyPath[1], opts, op ), vSep, vSepRaw])

  decodePath = (data) ->
    return precodec.decode(data)

  decodeKeyWithOptions = (key, opts) ->
    #v=[parent, key, separator, realSeparator]
    #realSeparator is optional only opts.separator && opts.separator != realSeparator
    v = precodec.decode(key, opts.separator)
    vSep = v[2] #separator
    vSep = PATH_SEP if (vSep == undefined)  #if the precodec is other codec.
    key = codec.decodeKey(v[1], opts);
    if opts.absoluteKey
        key = pathArrayToPath(v[0]) + vSep + key
    else if opts.path && isString(key) && key != ""
        vPath = path.relative(opts.path, v[0])
        if vPath == "" && vSep == PATH_SEP
          vSep = "" 
        else if vSep.length >= 2
          vSep = vSep.substring(1)
        key = vPath + vSep + key
    key

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
            key: encodePath(op._keyPath, opts, op)
            value: if op.type != 'del' then codec.encodeValue(op.value,opts,op) else undefined
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
        vNeedRedirect = aOptions.valueEncoding == "json" && isAlias(aKey)
        if aOptions.allowRedirect > 0 && vNeedRedirect
          aOptions.allowRedirect--
          aDb.get encodePath(resolveKeyPath([], aKey), aOptions), aOptions, (err, value) ->
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
                    cb(null, codec.decodeValue(value, aOptions))
              #switch(vNeedRedirect)
          # need redirect
          return 2
        else
          if (vNeedRedirect) then 1 else 0

      opts.asBuffer = codec.isValueAsBuffer(opts)
      return (db.db || db).get(
        encodePath(resolveKeyPath(aPath, key), opts),
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
          key = decodeKeyWithOptions(key, opts)
          if isObject(key)
            result.key = key.key
            result.separator = key.separator
          else
            result.key = key
        result.value = codec.decodeValue(value, opts) if value
        result

      if opts.keys isnt false && opts.values isnt false
        return (key, value) ->
          result =
            key: decodeKeyWithOptions(key, opts)
            value: codec.decodeValue(value, opts)
          if opts.absoluteKey isnt true
            result.path = pathArrayToPath(opts.path)
          result
      if opts.values isnt false
        return (_, value) -> codec.decodeValue(value, opts)
      if opts.keys isnt false
        return (key) -> decodeKeyWithOptions(key, opts)
      return ->

    iterator: (_opts) ->
      opts = clone(_opts || {})
      vPath = opts.path || []

      #the key is lowerBound or upperBound.
      #if opts.start is exists then lowBound key is opt.start
      console.log 'create iter'
      encodeKey = (key) ->
        console.log 'e=',vPath, key
        r= encodePath(resolveKeyPath(vPath, key), opts, {keyEncoding: 'utf8'})
        console.log r
        r

      #convert the lower/upper bounds to real lower/upper bounds.
      #precodec.lowerBound, precodec.upperBound are default bounds in case of the opts have no bounds.
      ltgt.toLtgt(opts, opts, encodeKey, precodec.lowerBound, precodec.upperBound) if opts.bounded isnt false

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

      opts.keyAsBuffer = precodec.buffer
      opts.valueAsBuffer = codec.isValueAsBuffer(opts)
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

