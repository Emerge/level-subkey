var path = require("path")
var through = require("through")
var EventEmitter = require('events').EventEmitter
var addpre = require('./range').addPrefix
var precodec = require("./codec")
var _nut = require('./nut')

var FILTER_INCLUDED = _nut.FILTER_INCLUDED
var FILTER_EXCLUDED = _nut.FILTER_EXCLUDED
var FILTER_STOPPED  = _nut.FILTER_STOPPED
var PATH_SEP = precodec.PATH_SEP
var SUBKEY_SEP = precodec.SUBKEY_SEP
var getPathArray = _nut.getPathArray
var resolveKeyPath = _nut.resolveKeyPath
var pathArrayToPath = _nut.pathArrayToPath

var errors = require('levelup/lib/errors')

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

  emitter.put = function (key, value, opts, cb) {
    if('function' === typeof opts) cb = opts, opts = {}
    if(!cb) cb = errback

    nut.apply([{
      separator: opts.separator,
      key: key, value: value,
      path: prefix.slice(), type: 'put'
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
    if(!cb) cb = errback

    nut.apply([{
      separator: opts.separator,
      key: key,
      path: prefix.slice(), type: 'del'
    }], mergeOpts(opts), function (err) {
      if(!err) { emitter.emit('del', key); cb(null) }
      if(err) return cb(err)
    })
  }

  emitter.batch = function (ops, opts, cb) {
    if('function' === typeof opts)
      cb = opts, opts = {}
    if(!cb) cb = errback

    ops = ops.map(function (op) {
      return {
        separator:     op.separator,
        key:           op.key,
        value:         op.value,
        path:        op.path || prefix,
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
    nut.get(key, prefix, mergeOpts(opts), function (err, value) {
      if(err) cb(new errors.NotFoundError('Key not found in database', err))
      else cb(null, value)
    })
  }

  emitter.sublevel = function (name, opts) {
    return emitter._sublevels['$' + name] =
      emitter._sublevels['$' + name] || sublevel(nut, prefix.concat(name), createStream, mergeOpts(opts))
  }

  function _addHook(key, callback, hooksAdd) {
      if(isFunction(key)) return hooksAdd([prefix], key)
      if(isString(key))   return hooksAdd(resolveKeyPath(prefix, key), callback)
      if(isObject(key))   return hooksAdd(addpre(prefix, key), callback)

      //TODO: handle ranges, needed for level-live-stream, etc.
      throw new Error('not implemented yet')
  }

  emitter.pre = function (key, hook) {
      return _addHook(key, hook, nut.pre)
  }

  emitter.post = function (key, hook) {
      return _addHook(key, hook, nut.post)
  }

  emitter.createReadStream = function (opts) {
    opts = mergeOpts(opts)
    opts.path = getPathArray(opts.path) || prefix

    var isFilterExists = isFunction(opts.filter)
    var vKeys=opts.keys, vValues=opts.values
    if (isFilterExists) {
        opts.keys = true
        opts.values = true
    }

    var stream
    var it = nut.iterator(opts, function (err, it) {
      stream.setIterator(it)
    })

    stream = createStream(opts, nut.createDecoder(opts))
    if(it) stream.setIterator(it)


    //to avoid the stream is a pull-stream
    if (!stream.type && isFilterExists) {
        var filterStream = through(function(item){
            switch (opts.filter(item.key, item.value)) {
                case  FILTER_EXCLUDED: return        //exclude
                case  FILTER_STOPPED : this.end()//this.emit('end')   //halt
                                       return
            }
            if (vKeys !== false && vValues !== false) {
                //this.emit('data',item)
                this.push(item)
            } else {
                if (vKeys !== false)  this.push(item.key)
                if (vValues !== false) this.push(item.value)//this.emit('data',item.value)
            }
        }, null)
        filterStream.writable = false
        stream = stream.pipe(filterStream)
    }

    return stream
  }

  emitter.createValueStream = function (opts) {
    opts = opts || {}
    opts.values = true
    opts.keys = false
    return emitter.createReadStream(opts)
  }

  emitter.createKeyStream = function (opts) {
    opts = opts || {}
    opts.values = false
    opts.keys = true
    return emitter.createReadStream(opts)
  }

  emitter.close = function (cb) {
    //TODO: deregister all hooks
    process.nextTick(cb || function () {})
  }

  return emitter
}
