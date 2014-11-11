var levelup = require('level-test')()

var base = require('../')(levelup('test-sublevels'))

var test = require('tape')

test('special names', function (t) {
  t.deepEqual(base.sublevels, {})

  var cons = base.subkey('constructor')
  var proto = base.subkey('__proto__')
  var toString = base.subkey('toString')

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

  t.strictEqual(base.subkey('constructor'), cons)
  t.strictEqual(base.subkey('__proto__'), proto)
  t.strictEqual(base.subkey('toString'), toString)

  t.strictEqual(cons.path(), '/constructor')
  t.deepEqual(proto.pathAsArray(), ['__proto__'])
  t.strictEqual(toString.path(), '/toString')

  var consBlerg = cons.subkey('blerg')
  t.deepEqual(cons._sublevels, {'$blerg': consBlerg})
  t.deepEqual(cons.sublevels, {'blerg': consBlerg})
  t.strictEqual(cons.subkey('blerg'), consBlerg)
  t.deepEqual(consBlerg.pathAsArray(), ['constructor', 'blerg'])
  t.strictEqual(consBlerg.path(), '/constructor/blerg')

  var consProto = cons.subkey('__proto__')
  t.deepEqual(cons._sublevels, {'$blerg': consBlerg, '$__proto__': consProto})
  t.deepEqual(cons.sublevels, {'blerg': consBlerg, '__proto__': consProto})
  t.strictEqual(cons.subkey('__proto__'), consProto)
  t.deepEqual(consProto.pathAsArray(), ['constructor', '__proto__'])

  t.end()
})





