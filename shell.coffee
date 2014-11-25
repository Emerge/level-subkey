precodec      = require("./codec")
util          = require("./util")
path          = require("./path")
through       = require("through")
addpre        = require("./range").addPrefix
_nut          = require("./nut")
errors        = require("./errors")
levelUtil     = require("levelup/lib/util")
WriteStream   = require("levelup/lib/write-stream")
ReadStream    = require('levelup/lib/read-stream')
InterfacedObject = require("./InterfacedObject")

ReadError     = errors.ReadError
NotFoundError = errors.NotFoundError
dispatchError = levelUtil.dispatchError

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
    @.prototype.__defineGetter__ "sublevels", ->
      deprecate "sublevels, all subkeys(sublevels) have cached on nut now."
      r = nut.subkeys(path.join(@_pathArray, "*"))
      result = {}
      for k of r
        result[path.basename(k)] = r[k]
      result
    @.prototype.__defineGetter__ "name", ->
      l = @_pathArray.length
      if l > 0 then @_pathArray[l-1] else PATH_SEP
    @.prototype.__defineGetter__ "fullName", ->
      PATH_SEP + @_pathArray.join(PATH_SEP)
    @.prototype.__defineGetter__ "value", ->
      if @_realKey? then @_realKey._value else @_value
    @.prototype.__defineSetter__ "value", (aValue)->
      if @_realKey?
        @_realKey._value = aValue
      else
        @_value = aValue
    @isAlias: nut.isAlias
    Class: Subkey
    _NUT: nut
    version: version
    isLoading: ->
      @_loaded is false
    isLoaded: ->
      @_loaded is true
    isUnload: ->
      not @_loaded?
    isAlias: ->
      @_realKey?
    loadValue: (aCallback) ->
      @_loaded = false
      aCallback ||= ->
      that = @
      vOptions = @options
      nut.get @fullName, [], vOptions, (err, value) ->
        if not err?
          that._value = value
          if vOptions.valueEncoding == "json" and Subkey.isAlias(value)
            nut.get value, [], that.mergeOpts({getRealKey: true}), (err, value)->
              nut.createSubkey value, Subkey.bind(null, value), vOptions, (err, result)->
                that._realKey = result
                aCallback(err, that)
                that._loaded = true
          else
            aCallback(null, that)
            that._loaded = true
        else
          aCallback(err, that)
          that._loaded = null
    load: (aReadyCallback)->
      if @isUnload() and nut.isOpen() is true
        vOptions = @options
        if vOptions and vOptions.loadValue isnt false
          @loadValue aReadyCallback
        else
          aReadyCallback(null, @) if aReadyCallback
    init: (aReadyCallback)->
      @methods = {}
      @unhooks = []
      @listeners =
        ready: @emit.bind(@, "ready")
        closing: @emit.bind(@, "closing")
        closed: @emit.bind(@, "closed")
        error: @emit.bind(@, "error")
      for event, listener of @listeners
        nut.on event, listener 
      @_loaded = null # null means not loaded, true means loaded, false means loading
      vOptions = @options
      that = @
      @load(aReadyCallback)
      @on "ready", ->
        that.load(aReadyCallback)
      @post @path(), (op, add)->
        switch op.type
          when "del"
            #TODO: it need delete all subkeys?
            # state?
            that._value = undefined
            if that._realKey
              that._realKey.free()
              that._realKey = undefined
          when "put"
            vValue = op.value
            if that._value isnt vValue
              that._value = vValue
              if that._realKey
                that._realKey.free()
                that._realKey = undefined
              if vOptions and vOptions.valueEncoding is "json" and Subkey.isAlias(vValue)
                nut.get vValue, [], that.mergeOpts({getRealKey: true}), (err, value)->
                  that._realKey = nut.createSubkey(value, Subkey.bind(null, value), vOptions)
    final: ->
      if @_realKey
        @_realKey.free()
        @_realKey = undefined
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
    constructor: (aKeyPath, aOptions, aCallback)->
      if isFunction aOptions
        aCallback = aOptions
        aOptions = {}
      if not (this instanceof Subkey)
        vKeyPath = path.normalizeArray getPathArray aKeyPath
        vSubkey = nut.createSubkey(vKeyPath, Subkey.bind(null, vKeyPath), aOptions, aCallback)
        return vSubkey

      super()
      @options = aOptions
      aKeyPath = getPathArray(aKeyPath)
      aKeyPath = if aKeyPath then path.normalizeArray(aKeyPath) else []
      @_pathArray = aKeyPath
      @self = @

      @init(aCallback)
    parent: ()->
      p = path.dirname @path()
      result = nut.subkey(p)
      #get latest parent
      while not result? and p != PATH_SEP
        p = path.dirname p
        result = nut.subkey(p)
      return result
    setPath: (aPath, aCallback) ->
      aPath = getPathArray(aPath)
      if aPath
        aPath = path.normalizeArray(aPath)
        vPath = @path() if @_pathArray?
        if vPath? and vPath isnt path.resolve(aPath)
          nut.delSubkey(vPath)
          @final()
          @_pathArray = aPath
          @init(aCallback)
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
    subkey: (name, opts, cb) ->
      return @_realKey.subkey.apply(@_realKey, arguments) if @_realKey
      vKeyPath = path.resolveArray(@_pathArray, name)
      vKeyPath.shift 0, 1
      if isFunction opts
        cb = opts
        opts = {}
      return Subkey(vKeyPath, @mergeOpts(opts), cb)
    sublevel: deprecate["function"]((name, opts, cb) ->
        @subkey name, opts, cb
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
      return @_realKey._doOperation.apply(@_realKey, arguments) if @_realKey
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
    ###
      put it self:
        put(cb)
        put(value, cb)
    ###
    put: (key, value, opts, cb) ->
      if isFunction(key) or arguments.length is 0
        cb = key
        key = "."
        value = @value
      else if isFunction value
        cb = value
        value = key
        key = "."
      @_doOperation({key:key, value:value, type: "put"}, opts, cb)
    ###TODO: del itself would destroy itself?  see: the post hook itself in init method.
      del itself:
      del(cb)
    ###
    del: (key, opts, cb) ->
      if isFunction(key) or arguments.length is 0
        cb = key
        key = @path() #use absolute key path to delete alias key itself
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
          if (/notfound/i).test(err)
            err = new NotFoundError(
                'Key not found in database [' + key + ']', err)
          else
            err = new ReadError(err)
          return dispatchError(that, err, cb)
        cb.call that, null, value
    alias: (aKeyPath, aAlias, aCallback) ->
      return @_realKey.alias.apply(@_realKey, arguments) if @_realKey
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
      return @_realKey.readStream.apply(@_realKey, arguments) if @_realKey
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
    createReadStream: @.prototype.readStream

    valueStream: (opts) ->
      opts = opts or {}
      opts.values = true
      opts.keys = false
      @readStream opts
    createValueStream: @.prototype.valueStream

    keyStream: (opts) ->
      opts = opts or {}
      opts.values = false
      opts.keys = true
      @readStream opts
    createKeyStream: @.prototype.keyStream

    writeStream: (opts) ->
      return @_realKey.writeStream.apply(@_realKey, arguments) if @_realKey
      opts = @mergeOpts(opts)
      new aCreateWriteStream(opts, @)
    createWriteStream: @.prototype.writeStream

    pathStream: (opts) ->
      opts = opts or {}
      opts.separator = PATH_SEP
      opts.separatorRaw = true
      opts.gte = "0"
      @readStream opts
    createPathStream: @.prototype.pathStream

  Subkey

