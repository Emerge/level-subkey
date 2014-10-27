var EventEmitter = require('events').EventEmitter
var addpre = require('./range').addPrefix
var PATH_SEP = require("./codec").PATH_SEP
var _nut = require('./nut')
var getPathArray = _nut.getPathArray
var resolveKeyPath = _nut.resolveKeyPath

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
  emitter.sublevels = {}
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
        if(options[k] != undefined)o[k] = options[k]
    if(opts)
      for(k in opts)
        if(opts[k] != undefined) o[k] = opts[k]
    return o
  }

  emitter.put = function (key, value, opts, cb) {
    if('function' === typeof opts) cb = opts, opts = {}
    if(!cb) cb = errback

    nut.apply([{
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
    return emitter.sublevels[name] =
      emitter.sublevels[name] || sublevel(nut, prefix.concat(name), createStream, mergeOpts(opts))
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
    opts.path = opts.path || prefix
    var stream
    var it = nut.iterator(opts, function (err, it) {
      stream.setIterator(it)
    })

    stream = createStream(opts, nut.createDecoder(opts))
    if(it) stream.setIterator(it)

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
