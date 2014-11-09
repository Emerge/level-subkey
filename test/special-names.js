var levelup = require('level-test')()

var base = require('../')(levelup('test-sublevels'))

var test = require('tape')

test('special names', function (t) {
  t.deepEqual(base.sublevels, {})

  var cons = base.sublevel('constructor')
  var proto = base.sublevel('__proto__')
  var toString = base.sublevel('toString')

  t.deepEqual(base._sublevels, {
    '$constructor': cons,
    '$__proto__': proto,
    '$toString': toString
  })
  t.deepEqual(base.sublevels, {
    'constructor': cons,
    '__proto__': proto,
    'toString': toString
  })
  t.deepEqual(cons.sublevels, {})

  t.strictEqual(base.sublevel('constructor'), cons)
  t.strictEqual(base.sublevel('__proto__'), proto)
  t.strictEqual(base.sublevel('toString'), toString)

  t.strictEqual(cons.path(), '/constructor')
  t.deepEqual(proto.pathAsArray(), ['__proto__'])
  t.strictEqual(toString.path(), '/toString')

  var consBlerg = cons.sublevel('blerg')
  t.deepEqual(cons._sublevels, {'$blerg': consBlerg})
  t.deepEqual(cons.sublevels, {'blerg': consBlerg})
  t.strictEqual(cons.sublevel('blerg'), consBlerg)
  t.deepEqual(consBlerg.pathAsArray(), ['constructor', 'blerg'])
  t.strictEqual(consBlerg.path(), '/constructor/blerg')

  var consProto = cons.sublevel('__proto__')
  t.deepEqual(cons._sublevels, {'$blerg': consBlerg, '$__proto__': consProto})
  t.deepEqual(cons.sublevels, {'blerg': consBlerg, '__proto__': consProto})
  t.strictEqual(cons.sublevel('__proto__'), consProto)
  t.deepEqual(consProto.pathAsArray(), ['constructor', '__proto__'])

  t.end()
})





