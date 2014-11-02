var levelup = require('level-test')()
var precodec = require('../codec')

var db = levelup('test-sublevel-path')
var base = require('../')(db)

var test = require('tape')

var SUBKEY_SEPS = precodec.SUBKEY_SEPS
var encode = precodec.encode
var SEP1 = SUBKEY_SEPS[0][1]
var SEP2 = SUBKEY_SEPS[0][2]
var SEP11= SUBKEY_SEPS[1][1] //escaped the SEP1

test('sublevel-path-get', function (t) {
  t.deepEqual(base.sublevels, {})

  var foo = base.sublevel('foo')
  var bar = base.sublevel('bar')

  base.batch([
    { key: 'a', value: 1, type: 'put', path: ['foo'] },
    { key: 'k', value: 2, type: 'put', path: '/foo' },
    { key: 'q', value: 3, type: 'put', path: "foo/a" },
    { key: 'z', value: 4, type: 'put', path: "foo/b" },
    { key: '../bar/b', value: 5, type: 'put', path: "foo"},
    //into the main base
    { key: 'b', value: 5, type: 'put', path: '/'},
    { key: '.b', value: 6, type: 'put', path: "bar" },
  ], function (err) {
    if (err) throw(err)
    bar.get("b", function(err, v){
        if (err) throw(err)
        t.equal(v, '5')
        foo.get('k', function(err,v){
          if (err) throw(err)
          t.equal(v, '2')
          foo.get('../bar/b', function(err,v){
            if (err) throw(err)
            t.equal(v, '5')

            foo.get('a/q', function(err,v){
                if (err) throw(err)
                t.equal(v, '3')
                foo.get('a', function(err,v){
                    if (err) throw(err)
                    t.equal(v, '1')
                    bar.get('.b', function(err,v){
                      if (err) throw(err)
                      t.equal(v, '6')
                      db.get('/bar/'+SEP11+'b', function(err,v){
                          if (err) throw(err)
                          t.equal(v, '6')
                          t.end()
                      })
                    })
                })
            })
          })
        })
    })

  })
})

test('sublevel-path-get-undefinedOpts', function (t) {
  base.batch([
    { key: 'abc', value: 1, type: 'put', path: ['foo'] },
  ])
  base.put( 'abc', 1)
  t.end()
})




