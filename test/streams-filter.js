var level = require('level-test')()
var sublevel = require('../')
var _nut = require('../nut')
var FILTER_EXCLUDED = _nut.FILTER_EXCLUDED
var FILTER_STOPPED = _nut.FILTER_STOPPED

require('tape')('sublevel-streams-filter', function (t) {

  require('rimraf').sync('/tmp/test-sublevel-readstream-filter')

  var db = level('test-sublevel-readstream-filter')
  var base = sublevel(db)

  var a    = base.subkey('A')

  var i = 0

  function all(db, opts, cb) {
    var o
    opts = opts || {}
    if (!opts.end) opts.end = '\uffff'
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

  function filter(key, value) {
      console.log("filter:", key, " v:", value)
      if (key.indexOf(".") < 0) return FILTER_EXCLUDED //return true to stop.
  }

  function filterEnd(key, value) {
      console.log("filter:", key, " v:", value)
      if (key == "d5") return FILTER_STOPPED //return true to stop.
  }
  function filterKeyOnly(key, value) {
      t.strictEqual(value, null)
      if (key == "d5") return FILTER_STOPPED //return true to stop.
  }
  function filterValue(key, value) {
      t.strictEqual(key, null)
      if (value == _d) return FILTER_STOPPED //return true to stop.
  }

  a.batch([
    {key: '1.a', value: _a , type: 'put'},
    {key: '2.b', value: _b , type: 'put'},
    {key: '3.c', value: _c , type: 'put'},
    {key: 'd4', value: _d , type: 'put'},
    {key: 'd5', value: _d , type: 'put'},
    {key: 'z6', value: _d , type: 'put'},
  ], function (err) {
    if(err) throw err
    all(a, {filter: filter}, function (err, obj) {
      t.deepEqual(obj, 
        { '1.a': _a,
          '2.b': _b,
          '3.c': _c
        })

      all(a, {filter: filterEnd}, function (err, obj) {
        t.deepEqual(obj, 
          { '1.a': _a,
            '2.b': _b,
            '3.c': _c,
            'd4' : _d
          })
          all(a, {filter: filterKeyOnly, values: false}, function (err, obj) {
            t.deepEqual(obj, 
              [ '1.a',
                '2.b',
                '3.c',
                'd4' 
              ])
              all(a, {filter: filterValue, keys: false}, function (err, obj) {
                t.deepEqual(obj, 
                  [  _a,
                     _b,
                     _c,
                  ])
                  t.end()
              })
          })
      })
    })
  })
})
