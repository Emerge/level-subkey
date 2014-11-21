var path = require('../path')
var levelup = require('level-test')()

var base = require('../')(levelup('test-sublevels'))

var test = require('tape')

test('subsections', function (t) {
  t.deepEqual(base.sublevels, {})

  var foo = base.subkey('foo')
  var bar = base.subkey('bar')

  t.deepEqual(base.sublevels, {'foo': foo, 'bar': bar})
  t.deepEqual(foo.sublevels, {})

  t.strictEqual(base.subkey('foo'), foo)
  t.strictEqual(base.subkey('bar'), bar)

  console.log('path:', foo.path())
  console.log('path:', bar.path())

  var fooBlerg = foo.subkey('blerg')
  t.deepEqual(foo.sublevels, {'blerg': fooBlerg})

  t.strictEqual(foo.subkey('blerg'), fooBlerg)
  t.strictEqual(base.subkey('foo/blerg'), fooBlerg)
  t.deepEqual(fooBlerg.pathAsArray(), ['foo', 'blerg'])
  t.end()
})

test.only('sublevels-hooks-free', function (t) {
  var bar = base.subkey('newBar')
  var barLess = bar.subkey('Less')
  var barMore = bar.subkey('more')

  var bm = bar.subkey('more'), bl = bar.subkey('Less')
  var bbm = base.subkey('newBar/more'), bbl = base.subkey('newBar/Less')
  var barb = base.subkey('newBar', {addRef: false})
  t.equal(bar.RefCount, 0)
  t.strictEqual(bar, barb)

  t.equal(barLess.RefCount, 2)
  t.equal(barMore.RefCount, 2)
  t.strictEqual(bm, barMore)
  t.strictEqual(bl, barLess)
  t.strictEqual(bbm, barMore)
  t.strictEqual(bbl, barLess)
  bm.free()
  bl.free()
  t.equal(barLess.RefCount, 1)
  t.equal(barMore.RefCount, 1)
  bbm.free()
  bbl.free()
  t.equal(barLess.RefCount, 0)
  t.equal(barMore.RefCount, 0)

  bar.pre(function(){})
  bar.post(function(){})
  barLess.pre(function(){})
  barLess.post(function(){})
  barMore.pre(function(){})
  barMore.post(function(){})

  t.strictEqual(bar.unhooks.length, 2)
  t.strictEqual(barLess.unhooks.length, 2)
  t.strictEqual(barMore.unhooks.length, 2)
  var expected = {}
  //expected[bar.path()] = bar
  expected[barLess.path()] = barLess
  expected[barMore.path()] = barMore
  t.deepEqual(base._NUT.subkeys(path.join(bar.pathAsArray(), "*")), expected)
  t.deepEqual(base._NUT.subkeys()[bar.path()], bar)
  base.free()
  t.equal(bar.RefCount, -1)
  t.equal(barLess.RefCount, -1)
  t.equal(barMore.RefCount, -1)
  t.strictEqual(bar.unhooks.length, 0)
  t.strictEqual(barLess.unhooks.length, 0)
  t.strictEqual(barMore.unhooks.length, 0)
  t.deepEqual(base._NUT.subkeys(path.join(bar.pathAsArray(), "*")), {})
  t.strictEqual(base._NUT.subkeys()[bar.path()], undefined)
  t.end()
})



test('sublevels-create-subkey-with-anyPath', function (t) {
  var foo = base.subkey('foo')
  var bar = foo.subkey('../bar')
  t.deepEqual(bar.pathAsArray(), ['bar'])
  var fooEggBig = foo.subkey('egg/big')
  t.deepEqual(fooEggBig.pathAsArray(), ['foo', 'egg', 'big'])
  t.deepEqual(bar.subkey('/abs/23/中央').pathAsArray(), ['abs', '23', '中央'])
  t.equal(base.name, '/')
  t.equal(base.fullName, '/')
  t.equal(base.path(), base.fullName)
  t.equal(fooEggBig.name, 'big')
  t.equal(fooEggBig.fullName, '/foo/egg/big')
  t.equal(fooEggBig.path(), fooEggBig.fullName)
  t.end()
})


