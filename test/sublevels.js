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
  t.deepEqual(fooBlerg.pathAsArray(), ['foo', 'blerg'])
  t.end()
})

test('sublevels-hooks-free', function (t) {
  var bar = base.subkey('newBar')
  t.deepEqual(bar.sublevels, {})
  var barLess = bar.subkey('Less')
  var barMore = bar.subkey('more')

  t.deepEqual(bar.sublevels, {'Less': barLess, 'more': barMore})

  t.strictEqual(bar.subkey('more'), barMore)
  t.strictEqual(bar.subkey('Less'), barLess)

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
  t.strictEqual(bar.unhooks.length, 0)
  t.strictEqual(barLess.unhooks.length, 0)
  t.strictEqual(barMore.unhooks.length, 0)
  t.deepEqual(bar.sublevels, {})
  t.deepEqual(barLess.sublevels, {})
  t.deepEqual(barMore.sublevels, {})
  t.end()
})




