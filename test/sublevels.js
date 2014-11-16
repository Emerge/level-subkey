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

test('sublevels-hooks-free', function (t) {
  var bar = base.subkey('newBar')
  var barLess = bar.subkey('Less')
  var barMore = bar.subkey('more')

  var bm = bar.subkey('more'), bl = bar.subkey('Less')
  var bbm = base.subkey('newBar/more'), bbl = base.subkey('newBar/Less')
  t.equal(barLess._reference, 3)
  t.equal(barMore._reference, 3)
  t.strictEqual(bm, barMore)
  t.strictEqual(bl, barLess)
  t.strictEqual(bbm, barMore)
  t.strictEqual(bbl, barLess)
  bm.close()
  bl.close()
  t.equal(barLess._reference, 2)
  t.equal(barMore._reference, 2)
  bbm.close()
  bbl.close()
  t.equal(barLess._reference, 1)
  t.equal(barMore._reference, 1)

  bar.pre(function(){})
  bar.post(function(){})
  barLess.pre(function(){})
  barLess.post(function(){})
  barMore.pre(function(){})
  barMore.post(function(){})

  t.strictEqual(bar.unhooks.length, 2)
  t.strictEqual(barLess.unhooks.length, 2)
  t.strictEqual(barMore.unhooks.length, 2)
  base.close()
  t.equal(bar._reference, 0)
  t.equal(barLess._reference, 0)
  t.equal(barMore._reference, 0)
  t.strictEqual(bar.unhooks.length, 0)
  t.strictEqual(barLess.unhooks.length, 0)
  t.strictEqual(barMore.unhooks.length, 0)
  t.end()
})




