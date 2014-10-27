var levelup = require('level-test')()

var base = require('../')(levelup('test-sublevel-path'))

var test = require('tape')

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
                    t.end()
                })
            })
          })
        })
    })

  })
})





