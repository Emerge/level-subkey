var level = require('level-test-sync')()
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

require('rimraf').sync('/tmp/test-sublevel-stream-last')

var db = level('test-sublevel-stream-last')
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
    if (!opts.end) opts.end = '\uffff'
    db.createReadStream(opts).on('data', function (data) {
      console.log("readStream:", data)
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
    {key: 'c8', value: _d+"8"},
    {key: 'd9', value: _d+"9"},
    {key: '/A/.3.c/abc', value: _c},
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
expectedResults[encodeKey('/A/c8')] = _d+"8"
expectedResults[encodeKey('/A/d9')] = _d+"9"
expectedResults[encodeKey('/A/.3.c/abc')] = _c

function writeTo(aStream, items) {
    for (var i=0; i< items.length; i++) {
        aStream.write(items[i]);
        console.log("write:", items[i]);
    }
}

tape('Stream-write', function (t) {

  var stream = a.createWriteStream()
  stream.on('err', function(err){
      throw err
  })
  stream.on('close', function(){
    console.log("writeStream close")
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
       t.end()
    })
  })
  writeTo(stream, writes)
  stream.end()
})

tape('Stream-on-Last', function (t) {
    var result = []
    a.createReadStream({absoluteKey: true, limit:2}).on('data', function (data) {
        result.push(data)
    })
    .on('last', function (lastKey) {
      console.log("last=", lastKey)
      t.equal(result.length, 2)
      t.strictEqual(lastKey, encodeKey(result[result.length-1].key))
      a.createReadStream({absoluteKey:true, limit:2, next:lastKey}).on('data', function(data){result.push(data)})
      .on('last', function(lastKey){
        console.log("last=", lastKey)
        t.equal(result.length, 4)
        t.strictEqual(lastKey, encodeKey(result[result.length-1].key))
        a.createReadStream({absoluteKey:true, limit:2, next:lastKey}).on('data', function(data){result.push(data)})
        .on('last', function(lastKey){
            console.log("last=", lastKey)
            t.equal(result.length, 6)
            t.strictEqual(lastKey, encodeKey(result[result.length-1].key))
            a.createReadStream({absoluteKey:true, limit:2, next:lastKey}).on('data', function(data){result.push(data)})
            .on('last', function(lastKey){
                console.log("last=", lastKey)
                t.equal(result.length, 6)
                t.strictEqual(lastKey, undefined)
                console.log("result=", result)
                t.end()
            })
        })
      })
    })
    .on('end', function(){
    })
    .on('error', function(err){
        throw err
    })

})

