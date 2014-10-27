var level = require('level-test')()
var sublevel = require('../')

require('tape')('sublevel-path-stream', function (t) {

  require('rimraf').sync('/tmp/test-sublevel-path-stream')

  var db = level('test-sublevel-path-stream')
  var base = sublevel(db)

  var a    = base.sublevel('A')

  var i = 0

  function all(db, opts, cb) {
    var o = {}
    opts = opts || {}
    opts.end = '\xff\xff'
    db.createReadStream(opts).on('data', function (data) {
      o[data.key.toString()] = data.value.toString()
    })
    .on('end', function () {
      cb(null, o)
    })
    .on('error', cb)
  }

  var _a, _b, _c

  a.batch([
    {key: 'a', value: _a ='AAA_'+Math.random(), type: 'put'},
    {key: 'b', value: _b = 'BBB_'+Math.random(), type: 'put'},
    {key: 'c', value: _c = 'CCC_'+Math.random(), type: 'put'},
  ], function (err) {
    if(err) throw err
    all(db, {}, function (err, obj) {
      console.log(obj)
      t.deepEqual(obj, 
        { '/A#a': _a,
          '/A#b': _b,
          '/A#c': _c
        })

      all(a, {absoluteKey: true}, function (err, obj) {
        console.log(obj)
        t.deepEqual(obj, 
          { '/A/a': _a,
            '/A/b': _b,
            '/A/c': _c
          })
        t.end()
      })
    })
  })
})
