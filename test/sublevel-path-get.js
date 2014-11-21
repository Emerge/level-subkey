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

  var foo = base.subkey('foo')
  var bar = base.subkey('bar')


  base.batch([
    { key: 'bar', value: "HiBar", type: 'put', valueEncoding: 'json'},
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

test('sublevel-path-get-prefix', function (t) {
  base.get("b", {prefix: "bar"}, function(err, v){
    if (err) throw(err)
    t.equal(v, '5')
    t.end()
  })
})

test('sublevel-path-setPath', function (t) {
  var bar = base.subkey('bar')

  bar.setPath("../foo")
  t.equal(bar.path(), '/foo')
  bar.get("a", function(err, v){
    if (err) throw(err)
    t.equal(v, '1')
    t.end()
  })
})

test('sublevel-path-setPathViaObject', function (t) {
  var bar = base.subkey('bar')
  var foo = base.subkey('foo')
 
  bar.setPath(foo)
  t.equal(bar.path(), '/foo')
  bar.get("a", function(err, v){
    if (err) throw(err)
    t.equal(v, '1')
    t.end()
  })
})

test('sublevel-path-parent', function (t) {
  var bar = base.subkey('bar')
  var foo = base.subkey('foo')
  var barA = bar.subkey('Axq')
  var fooA1 = base.subkey('/foo/a/a3F2e/1')
 
  t.equal(bar.path(), '/bar')
  t.equal(bar.parent(), base, "bar's parent is root")
  t.equal(barA.parent(), bar, "barA's parent is bar")
  t.equal(fooA1.parent(), foo)
  var fooa= base.subkey('/foo/a')
  t.equal(fooA1.parent(), fooa)
  t.end()
})

test('sublevel-get-alias', function (t) {
  var bar = base.subkey('bar')
  var foo = base.subkey('foo')
 
  base.alias("/foo/a/q", "/bar/foo/alias/q", function(err) {
    if (err) throw(err)
    bar.get("foo/alias/q", {valueEncoding: 'json'},function(err, v){
      if (err) throw(err)
      t.strictEqual(v, 3)
      t.end()
    })
  })
})
test('sublevel-get-alias2', function (t) {
  var bar = base.subkey('bar')
  var foo = base.subkey('foo')
 
  bar.alias("/foo/bar", function(err) {
    if (err) throw(err)
    foo.get("bar", {valueEncoding: 'json'},function(err, v){
      if (err) throw(err)
      t.strictEqual(v, "HiBar")
      t.end()
    })
  })
})
test('sublevel-get-alias3', function (t) {
  var bar = base.subkey('bar')
  var foo = base.subkey('foo')
  var fooBar2 = base.subkey('foo/bar2')
 
  bar.alias(fooBar2, function(err) {
    if (err) throw(err)
    foo.get("bar2", {valueEncoding: 'json'},function(err, v){
      if (err) throw(err)
      t.strictEqual(v, "HiBar")
      t.end()
    })
  })
})
test('sublevel-get-alias4', function (t) {
  var bar = base.subkey('bar')
  var foo = base.subkey('foo')
  var fooBar3 = base.subkey('foo/bar3')
 
  base.alias(bar, fooBar3, function(err) {
    if (err) throw(err)
    foo.get("bar3", {valueEncoding: 'json'},function(err, v){
      if (err) throw(err)
      t.strictEqual(v, "HiBar")
      t.end()
    })
  })
})
test('sublevel-path-get-self', function (t) {
  var bar = base.subkey('bar')
  bar.get({valueEncoding: 'json'}, function(err, v){
    if (err) throw(err)
    t.equal(v, 'HiBar')
    t.end()
  })
})
test('sublevel-path-get-self2', function (t) {
  var bar = base.subkey('bar')
  bar.get(function(err, v){
    if (err) throw(err)
    t.equal(v, '"HiBar"')
    t.end()
  })
})

