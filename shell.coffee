precodec      = require("./codec")
util          = require("./util")
path          = require("./path")
through       = require("through")
addpre        = require("./range").addPrefix
_nut          = require("./nut")
errors        = require("levelup/lib/errors")
WriteStream   = require("levelup/lib/write-stream")
ReadStream    = require('levelup/lib/read-stream')
InterfacedObject = require("./InterfacedObject")

setImmediate  = global.setImmediate or process.nextTick

deprecate = require("depd")("level-subkey")
deprecate.assignProperty = (object, deprecatedProp, currentProp) ->
  if object[deprecatedProp]
    this deprecatedProp + " property, use `" + currentProp + "` instead."
    object[currentProp] = object[deprecatedProp]  unless object[currentProp]
    delete object[deprecatedProp]

assignDeprecatedPrefixOption = (options) ->
  deprecate.assignProperty options, "prefix", "path"


FILTER_INCLUDED = _nut.FILTER_INCLUDED
FILTER_EXCLUDED = _nut.FILTER_EXCLUDED
FILTER_STOPPED  = _nut.FILTER_STOPPED
PATH_SEP        = precodec.PATH_SEP
SUBKEY_SEP      = precodec.SUBKEY_SEP
getPathArray    = _nut.getPathArray
resolveKeyPath  = _nut.resolveKeyPath
pathArrayToPath = _nut.pathArrayToPath
isFunction      = util.isFunction
isString        = util.isString
isObject        = util.isObject
inherits        = util.inherits

version = require("./package.json").version


sublevel = module.exports = (nut, aCreateReadStream = ReadStream, aCreateWriteStream = WriteStream) ->
  class Subkey
    inherits(Subkey, InterfacedObject)
    _NUT: nut
    version: version
    init: ->
      @methods = {}
      @unhooks = []
      @listeners =
        ready: @emit.bind(@, "ready")
        closing: @emit.bind(@, "closing")
        closed: @emit.bind(@, "closed")
      for event, listener of @listeners
        nut.on event, listener 
    final: ->
      #deregister all hooks
      unhooks = @unhooks
      i = 0

      while i < unhooks.length
        unhooks[i]()
        i++
      @unhooks = []
      for event, listener of @listeners
        nut.removeListener event, listener
      @freeSubkeys()
    constructor: (aKeyPath, @options)->
      if not (this instanceof Subkey)
        vKeyPath = path.normalizeArray getPathArray aKeyPath
        vSubkey = nut.createSubkey(vKeyPath, Subkey.bind(null, vKeyPath), options)
        return vSubkey

      super()
      aKeyPath = getPathArray(aKeyPath)
      aKeyPath = if aKeyPath then path.normalizeArray(aKeyPath) else []
      @_pathArray = aKeyPath
      @self = @

      @__defineGetter__ "sublevels", ->
        deprecate "sublevels, all subkeys(sublevels) have cached on nut now."
        r = nut.subkeys(path.join(@_pathArray, "*"))
        result = {}
        for k of r
          result[path.basename(k)] = r[k]
        result
      # end __defineGetter__ "sublevels"
      @__defineGetter__ "name", ->
        l = @_pathArray.length
        if l > 0 then @_pathArray[l-1] else PATH_SEP
      # end __defineGetter__ "name"
      @__defineGetter__ "fullName", ->
        PATH_SEP + @_pathArray.join(PATH_SEP)
      # end __defineGetter__ "fullName"
      @init()
    parent: ()->
      p = path.dirname @path()
      result = nut.subkey(p)
      #get latest parent
      while not result? and p != PATH_SEP
        p = path.dirname p
        result = nut.subkey(p)
      return result
    setPath: (aPath) ->
      aPath = getPathArray(aPath)
      if aPath
        aPath = path.normalizeArray(aPath)
        vPath = @path() if @_pathArray?
        if vPath? and vPath isnt path.resolve(aPath)
          nut.delSubkey(vPath)
          @final()
          @_pathArray = aPath
          @init()
          return true
      false
    _addHook: (key, callback, hooksAdd) ->
      return hooksAdd([@_pathArray], key)  if isFunction(key)
      return hooksAdd(resolveKeyPath(@_pathArray, key), callback)  if isString(key)
      return hooksAdd(addpre(@_pathArray, key), callback)  if isObject(key)
      #TODO: handle ranges, needed for level-live-stream, etc.
      throw new Error("not implemented yet")
    _defaultCallback:(err) ->
      @emit "error", err if err
    mergeOpts: (opts) ->
      o = {}
      if @options
        for k of @options
          o[k] = @options[k]  if @options[k] isnt `undefined`
      if opts
        for k of opts
          o[k] = opts[k]  if opts[k] isnt `undefined`
      o
    #the writeStream use db.isOpen and db.once('ready') to ready write stream.
    isOpen: ->
      nut.isOpen()
    pathAsArray: ->
      @_pathArray.slice()
    prefix: deprecate["function"](->
        @pathAsArray()
      , "prefix(), use `pathAsArray()` instead, or use path() to return string path..")
    path: (aPath, aOptions) ->
      if aPath is `undefined`
        @fullName
      else
        @subkey aPath, aOptions
    subkey: (name, opts) ->
      vKeyPath = path.resolveArray(@_pathArray, name)
      vKeyPath.shift 0, 1
      return Subkey(vKeyPath, @mergeOpts(opts))
    sublevel: deprecate["function"]((name, opts) ->
        @subkey name, opts
      , "sublevel(), use `subkey(name)` or `path(name)` instead.")
 
    freeSubkeys: (aKeyPattern) ->
      unless aKeyPattern
        aKeyPattern = path.join(@_pathArray, "*")
      else
        aKeyPattern = path.resolve(@_pathArray, aKeyPattern)
      vSubkeys = nut.subkeys(aKeyPattern)
      for k of vSubkeys
        vSubkeys[k].free()
      return
    destroy: ->
      super
      @final()
    _doOperation: (aOperation, opts, cb) ->
      if isFunction opts
        cb = opts
        opts = {}
      else opts = {}  if opts is `undefined`
      cb = @_defaultCallback unless cb
      assignDeprecatedPrefixOption opts
      vPath = if isString(opts.path) and opts.path.length then getPathArray(opts.path) else @_pathArray
      that = @
      if util.isArray(aOperation)
        vType = "batch"
        aOperation = aOperation.map((op) ->
          separator: op.separator
          key: op.key
          value: op.value
          path: op.path or vPath
          keyEncoding: op.keyEncoding # *
          valueEncoding: op.valueEncoding # * (TODO: encodings on sublevel)
          type: op.type
        )
        vInfo = [vType, aOperation]
      else
        vType = aOperation.type
        vInfo = [vType, aOperation.key, aOperation.value]
        aOperation = [
          separator: opts.separator
          path: vPath
          key: aOperation.key
          value: aOperation.value
          type: aOperation.type
        ]
      nut.apply aOperation, @mergeOpts(opts), (err) ->
        unless err
          that.emit.apply that, vInfo
          cb.call that, null
        cb.call that, err  if err
    put: (key, value, opts, cb) ->
      @_doOperation({key:key, value:value, type: "put"}, opts, cb)
    del: (key, opts, cb) ->
      @_doOperation({key:key, type: "del"}, opts, cb)
    batch: (ops, opts, cb) ->
      @_doOperation(ops, opts, cb)
    get: (key, opts, cb) ->
      if isFunction opts
        cb = opts
        opts = {}
      if isObject key
        opts = key
        key = "."
      else if isFunction key
        cb = key
        opts = {}
        key = "."
      assignDeprecatedPrefixOption opts
      vPath = if isString(opts.path) then getPathArray(opts.path) else @_pathArray
      opts.path = getPathArray(opts.path)  if opts.path
      that = @
      nut.get key, vPath, @mergeOpts(opts), (err, value) ->
        if err
          cb.call that, new errors.NotFoundError("Key not found in database", err)
        else
          cb.call that, null, value
    alias: (aKeyPath, aAlias, aCallback) ->
      if isFunction aAlias
        aCallback = aAlias
        aAlias = aKeyPath
        aKeyPath = @path()
      aKeyPath = aKeyPath.path() if isFunction aKeyPath.path
      aAlias = aAlias.path() if isFunction aAlias.path
      @_alias(aKeyPath, aAlias, aCallback)
    _alias: (aKeyPath, aAlias, aCallback) ->
      @_doOperation({key:aAlias, value:aKeyPath, type: "put"}, {valueEncoding: 'utf8'}, aCallback)
    pre: (key, hook) ->
      unhook = @_addHook(key, hook, nut.pre)
      @unhooks.push unhook
      lst = @unhooks
      return ->
        i = lst.indexOf(unhook)
        lst.splice i, 1  if ~i
        unhook()

    post: (key, hook) ->
      unhook = @_addHook(key, hook, nut.post)
      @unhooks.push unhook
      lst = @unhooks
      return ->
        i = lst.indexOf(unhook)
        lst.splice i, 1  if ~i
        unhook()

    readStream: (opts) ->
      opts = @mergeOpts(opts)
      assignDeprecatedPrefixOption opts
      
      #the opts.path could be relative
      opts.path = getPathArray(opts.path, @_pathArray) or @_pathArray
      isFilterExists = isFunction(opts.filter)
      stream = aCreateReadStream(opts, nut.createDecoder(opts))
      it = nut.iterator(opts, (err, it) ->
        stream.setIterator it
        it.stream = stream
      )
      
      #to avoid the stream is a pull-stream
      if not stream.type and isFilterExists
        filterStream = through((item) ->
          vKey = vValue = null
          if isObject(item)
            vKey = item.key
            vValue = item.value
          else if opts.keys isnt false
            vKey = item
          else vValue = item  if opts.values isnt false
          switch opts.filter(vKey, vValue)
            when FILTER_EXCLUDED #exclude
              return
            when FILTER_STOPPED #this.emit('end')   //halt
              @end()
              return
          
          #this.emit('data',item)
          @push item
        , null)
        filterStream.writable = false
        stream = stream.pipe(filterStream)
      stream
    createReadStream: Subkey.prototype.readStream

    valueStream: (opts) ->
      opts = opts or {}
      opts.values = true
      opts.keys = false
      @readStream opts
    createValueStream: Subkey.prototype.valueStream

    keyStream: (opts) ->
      opts = opts or {}
      opts.values = false
      opts.keys = true
      @readStream opts
    createKeyStream: Subkey.prototype.keyStream

    writeStream: (opts) ->
      opts = @mergeOpts(opts)
      new aCreateWriteStream(opts, @)
    createWriteStream: Subkey.prototype.writeStream

    pathStream: (opts) ->
      opts = opts or {}
      opts.separator = PATH_SEP
      opts.separatorRaw = true
      opts.gte = "0"
      @readStream opts
    createPathStream: Subkey.prototype.pathStream

  Subkey

