var path = require("./path")
var through = require("through")
var EventEmitter = require('events').EventEmitter
var addpre = require('./range').addPrefix
var precodec = require("./codec")
var _nut = require('./nut')
var deprecate = require('depd')('level-subkey')

var FILTER_INCLUDED = _nut.FILTER_INCLUDED
var FILTER_EXCLUDED = _nut.FILTER_EXCLUDED
var FILTER_STOPPED  = _nut.FILTER_STOPPED
var PATH_SEP = precodec.PATH_SEP
var SUBKEY_SEP = precodec.SUBKEY_SEP
var getPathArray = _nut.getPathArray
var resolveKeyPath = _nut.resolveKeyPath
var pathArrayToPath = _nut.pathArrayToPath

var errors = require('levelup/lib/errors')
var WriteStream = require('levelup/lib/write-stream')


function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

function isObject (o) {
  return o && 'object' === typeof o
}

var version = require('./package.json').version

var sublevel = module.exports = function (nut, prefix, createStream, options) {
  var emitter = new EventEmitter()
  emitter._sublevels = {}
  emitter.__defineGetter__("sublevels", function(){
      var result = {}
      for (var k in this._sublevels) {
          result[k.substring(1)] = this._sublevels[k]
      }
      return result
  })

  emitter.options = options

  emitter.version = version

  emitter.methods = {}
  emitter.unhooks = []

  prefix = prefix || []

  function errback (err) { if (err) emitter.emit('error', err) }

  createStream = createStream || function (e) { return e }

  function mergeOpts(opts) {
    var k, o = {}
    if(options)
      for(k in options)
        if(options[k] !== undefined)o[k] = options[k]
    if(opts)
      for(k in opts)
        if(opts[k] !== undefined) o[k] = opts[k]
    return o
  }

  //emitter.on = nut.on
  //emitter.once = nut.once
  //the writeStream use db.isOpen and db.once('ready') to ready write stream.
  emitter.isOpen = function(){return nut.isOpen()}
  emitter.put = function (key, value, opts, cb) {
    if('function' === typeof opts) cb = opts, opts = {}
    else if (opts === undefined) opts = {}
    if(!cb) cb = errback
    if (opts.prefix) deprecate.property(opts, 'prefix', 'prefix option, use `path` instead.')
    if (opts.prefix && !opts.path) opts.path = opts.prefix
    var vPath = isString(opts.path) && opts.path.length ? getPathArray(opts.path): prefix

    nut.apply([{
      separator: opts.separator,
      key: key, value: value,
      path: vPath, type: 'put'
    }], mergeOpts(opts), function (err) {
      if(!err) { emitter.emit('put', key, value); cb(null) }
      if(err) return cb(err)
    })
  }

  emitter.pathAsArray = function () {
    return prefix.slice()
  }

  emitter.path = function () {
    return PATH_SEP + prefix.join(PATH_SEP)
  }

  emitter.setPath = function (aPath) {
      aPath = getPathArray(aPath)
      if (aPath) {
          prefix = aPath
          return true
      } else {
          return false
      }
  }

  emitter.del = function (key, opts, cb) {
    if('function' === typeof opts) cb = opts, opts = {}
    else if (opts === undefined) opts = {}
    if(!cb) cb = errback
    if (opts.prefix) deprecate.property(opts, 'prefix', 'prefix option, use `path` instead.')
    if (opts.prefix && !opts.path) opts.path = opts.prefix
    var vPath = isString(opts.path) && opts.path.length ? getPathArray(opts.path): prefix

    nut.apply([{
      separator: opts.separator,
      key: key,
      path: vPath, type: 'del'
    }], mergeOpts(opts), function (err) {
      if(!err) { emitter.emit('del', key); cb(null) }
      if(err) return cb(err)
    })
  }

  emitter.batch = function (ops, opts, cb) {
    if('function' === typeof opts)
      cb = opts, opts = {}
    else if (opts === undefined) opts = {}
    if(!cb) cb = errback
    if (opts.prefix) deprecate.property(opts, 'prefix', 'prefix option, use `path` instead.')
    if (opts.prefix && !opts.path) opts.path = opts.prefix
    var vPath = isString(opts.path) && opts.path.length ? getPathArray(opts.path): prefix
    ops = ops.map(function (op) {
      return {
        separator:     op.separator,
        key:           op.key,
        value:         op.value,
        path:          op.path || vPath,
        separator:     op.separator,
        keyEncoding:   op.keyEncoding,    // *
        valueEncoding: op.valueEncoding,  // * (TODO: encodings on sublevel)
        type:          op.type
      }
    })

    nut.apply(ops, mergeOpts(opts), function (err) {
      if(!err) { emitter.emit('batch', ops); cb(null) }
      if(err) return cb(err)
    })
  }

  emitter.get = function (key, opts, cb) {
    if('function' === typeof opts)
      cb = opts, opts = {}
    if (opts.prefix) deprecate.property(opts, 'prefix', 'prefix option, use `path` instead.')
    if (opts.prefix && !opts.path) opts.path = opts.prefix
    var vPath = isString(opts.path) ? getPathArray(opts.path): prefix
    if (opts.path) opts.path = getPathArray(opts.path)
    nut.get(key, vPath, mergeOpts(opts), function (err, value) {
      if(err) cb(new errors.NotFoundError('Key not found in database', err))
      else cb(null, value)
    })
  }

  emitter.subkey = function (name, opts) {
    return emitter._sublevels['$' + name] =
      emitter._sublevels['$' + name] || sublevel(nut, prefix.concat(name), createStream, mergeOpts(opts))
  }

  emitter.sublevel = deprecate['function'](function(name, opts) {
    return emitter.subkey(name, opts);
  }, 'sublevel, use `subkey` instead.');

  function _addHook(key, callback, hooksAdd) {
      if(isFunction(key)) return hooksAdd([prefix], key)
      if(isString(key))   return hooksAdd(resolveKeyPath(prefix, key), callback)
      if(isObject(key))   return hooksAdd(addpre(prefix, key), callback)

      //TODO: handle ranges, needed for level-live-stream, etc.
      throw new Error('not implemented yet')
  }

  emitter.pre = function (key, hook) {
      var unhook = _addHook(key, hook, nut.pre)
      this.unhooks.push(unhook)
      return function() {
          var i = this.unhooks.indexOf(unhook)
          if (~i) this.unhooks.splice(i, 1)
          return unhook()
      }
  }

  emitter.post = function (key, hook) {
      var unhook = _addHook(key, hook, nut.post)
      this.unhooks.push(unhook)
      return function() {
          var i = this.unhooks.indexOf(unhook)
          if (~i) this.unhooks.splice(i, 1)
          return unhook()
      }
  }

  emitter.readStream = emitter.createReadStream = function (opts) {
    opts = mergeOpts(opts)
    if (opts.prefix) deprecate.property(opts, 'prefix', 'prefix option, use `path` instead.')
    if (opts.prefix && !opts.path) opts.path = opts.prefix
    //the opts.path could be relative
    opts.path = getPathArray(opts.path, prefix) || prefix

    var isFilterExists = isFunction(opts.filter)

    var stream = createStream(opts, nut.createDecoder(opts))
    var it = nut.iterator(opts, function (err, it) {
      stream.setIterator(it)
      it.stream = stream
    })

    //to avoid the stream is a pull-stream
    if (!stream.type && isFilterExists) {
        var filterStream = through(function(item){
            var vKey = vValue = null
            if (isObject(item))
              vKey = item.key, vValue = item.value
            else if (opts.keys !== false)
              vKey = item
            else if (opts.values !== false)
              vValue = item
            switch (opts.filter(vKey, vValue)) {
                case  FILTER_EXCLUDED: return        //exclude
                case  FILTER_STOPPED : this.end()//this.emit('end')   //halt
                                       return
            }
            //this.emit('data',item)
            this.push(item)
        }, null)
        filterStream.writable = false
        stream = stream.pipe(filterStream)
    }

    return stream
  }

  emitter.valueStream = emitter.createValueStream = function (opts) {
    opts = opts || {}
    opts.values = true
    opts.keys = false
    return emitter.createReadStream(opts)
  }

  emitter.keyStream = emitter.createKeyStream = function (opts) {
    opts = opts || {}
    opts.values = false
    opts.keys = true
    return emitter.createReadStream(opts)
  }

  //todo:
  emitter.writeStream = emitter.createWriteStream = function(opts) {
    opts = mergeOpts(opts)
    return new WriteStream(opts, emitter)
  }
  emitter.pathStream = emitter.createPathStream = function(opts) {
      opts = opts || {}
      opts.separator = PATH_SEP
      opts.separatorRaw = true
      opts.gte = '0'
      return emitter.createReadStream(opts)
  }
  /*
  emitter.open = function (cb) {
      nut.open(cb)
  }
  */
  emitter.close = function (cb) {
    //deregister all hooks
    var unhooks = this.unhooks
    for (var i=0;i< unhooks.length; i++) {
        unhooks[i]()
    }
    this.unhooks = []
    for (var k in this._sublevels) {
        this._sublevels[k].close()
    }
    this._sublevels = {}
    nut.close(cb)
    //process.nextTick(cb || function () {})
  }

  return emitter
}
