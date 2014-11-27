var level = require('level-test')()
var path  = require("path")
var sublevel = require('../')
var precodec = require('../lib/codec')

var _nut = require('../lib/DBCore')
var tape = require('tape')

var FILTER_EXCLUDED = _nut.FILTER_EXCLUDED
var FILTER_STOPPED = _nut.FILTER_STOPPED
var getPathArray = _nut.getPathArray
var resolveKeyPath = _nut.resolveKeyPath
var pathArrayToPath = _nut.pathArrayToPath
var pathToPathArray = _nut.pathToPathArray
var SUBKEY_SEPS = precodec.SUBKEY_SEPS
var encode = precodec.encode

require('rimraf').sync('/tmp/test-sublevel-writestream')

var db = level('test-sublevel-writestream')
var base = sublevel(db)

var a    = base.subkey('A')
var b    = base.subkey('B')
var aI    = a.subkey('I')

function encodeKey(s, separator) {
    var p = path.dirname(s), k=path.basename(s)
    p = [pathToPathArray(p)]
    p.push(k)
    if (separator) p.push(separator)
    return encode(p)
}

  function all(db, opts, cb) {
    var o
    opts = opts || {}
    if (!opts.end) opts.end = '\xff\xff'
    db.createReadStream(opts).on('data', function (data) {
      if (data.key) {
          if(!o) o={}
          o[data.key.toString()] = data.value.toString()
      }
      else {
        if (!o) o = []
        o.push(data)
      }
    })
    .on('end', function () {
      cb(null, o)
    })
    .on('error', cb)
  }

  var _a='AAA_'+Math.random(), _b= 'BBB_'+Math.random(), _c= 'CCC_'+Math.random()
  var _d = "DDD_2333"

function filterEmpty(key, value)  {
    //console.log("fe=", key)
}

var writes = [
    {key: '/A/.1.a', value: _a},
    {key: '/A/.2.b', value: _b},
    {key: '/A/.3.c', value: _c},
    {key: '/A/.3.d', value: _d},
    {key: '/A/.3.cKey', value: _c},
    {key: '/A/d4', value: _d+"4"},
    {key: '/A/d5', value: _d+"5"},
    {key: '/A/z6', value: _d+"6"},
    {key: 'c7', value: _d+"7"},
    {key: '/A/.3.c/abc', value: _c},
    {key: '../B/123', value: _d},
  ]


var expectedResults = {}
expectedResults[encodeKey('/A/.1.a')] = _a
expectedResults[encodeKey('/A/.2.b', '.')] = _b
expectedResults[encodeKey('/A/.3.c', '.')] = _c
expectedResults[encodeKey('/A/.3.d', '.')] = _d
expectedResults[encodeKey('/A/.3.cKey')] = _c
expectedResults[encodeKey('/A/d4')] = _d+"4"
expectedResults[encodeKey('/A/d5')] = _d+"5"
expectedResults[encodeKey('/A/z6')] = _d+"6"
expectedResults[encodeKey('/A/c7')] = _d+"7"
expectedResults[encodeKey('/A/.3.c/abc')] = _c
expectedResults[encodeKey('/B/123')] = _d

function writeTo(aStream, items) {
    for (var i=0; i< items.length; i++) {
        aStream.write(items[i]);
        console.log("write:", items[i]);
    }
}

tape('writeStream', function (t) {

  var stream = a.createWriteStream()
  stream.on('err', function(err){
      throw err
  })
  stream.on('close', function(){
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
      b.get("123", function(err, value){
        if(err) throw err
        t.equal(value, _d)
        t.end()
      })
    })
  })
  writeTo(stream, writes)
  stream.end()
})

tape('writeStream-2', function (t) {

    var w2 = [
    {key: '.1.a', value: _a},
    {key: '.2.b', value: _b},
    {key: '.3.c', value: _c},
    {key: '.3.d', value: _d},
    {key: '.3.cKey', value: _c},
    {key: 'd4', value: _d+"4"},
    {key: 'd5', value: _d+"5"},
    {key: 'z6', value: _d+"6"},
    {key: 'c7', value: _d+"7"},
    {key: '.3.c/abc', value: _c},
  ]
  var w2keys= {
      'd4': _d+"4",
      'd5': _d+"5",
      'z6': _d+"6",
      'c7': _d+"7"
  }

  var stream = aI.createWriteStream()
  stream.on('err', function(err){
      throw err
  })
  stream.on('close', function(){
    all(aI, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, w2keys)
       t.end()
    })
  })
  writeTo(stream, w2)
  stream.end()
})

