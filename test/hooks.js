var levelup = require('level-test')()

var base = require('../')(levelup('test-sublevels', {valueEncoding: 'json'}))

var test = require('tape')

test('subsections', function (t) {

  var foo = base.subkey('foo')
  var bar = base.subkey('bar')

  var n, m, o = m = n = 0
  var bo, bp1, bp, b, q, r = q = b = bp = bp1 = bo = 0

  foo.post(function (op) {
    n ++
  })

  //this should do the same
  foo.post({}, function (op) {
    m ++
  })

  foo.post({gte: 'm'}, function (op) {
    o ++
  })

  foo.pre(function (op) {
    t.equal(op.type, 'put')
    q ++
  })

  base.pre(function (op) {
    t.equal(op.type, 'put')
    r ++
  })

  bar.pre(function (op) {
    t.equal(op.type, 'put')
    b ++
  })

  var _addCount = 0, other2PreTriggered = false, otherPreTriggered = false
  bar.pre('.*',function (op, add) {
    t.equal(op.type, 'put')
    bp ++
    ++_addCount
    if (_addCount === 1) add({ key: '.other', value: 8, type: 'put', triggerBefore: false})
    if (_addCount === 2) add({ key: '.other2', value: 9, type: 'put', triggerAfter: false})
    if (op.key === '.other2') other2PreTriggered = true
    else if (op.key === '.other') otherPreTriggered = true
  })

  bar.post('.*',function (op) {
    t.equal(op.type, 'put')
    bp1 ++
  })

  bar.post({gte: '.\u0000', lte: '.\uffff'},function (op) {
    t.equal(op.type, 'put')
    bo ++
  })

  base.batch([
    { key: 'a', value: 1, type: 'put', path: foo },
    { key: 'k', value: 2, type: 'put', path: foo },
    { key: 'q', value: 3, type: 'put', path: foo },
    { key: 'z', value: 4, type: 'put', path: foo },
    //into the main base
    { key: 'b', value: 5, type: 'put'},
    { key: 'b', value: 5, type: 'put', path: bar},
    { key: '.at', value: 6, type: 'put', path: bar},
    {key: '3.d', value: 7, type: 'put', path: bar, separator: '.'},
  ], function (err) {
    t.equal(n, 4)
    t.equal(m, 4)
    t.equal(o, 2)
    t.equal(q, 4)
    t.equal(r, 1)
    t.equal(b, 4)
    t.equal(bp, 3)
    t.equal(bp1, 3)
    t.equal(otherPreTriggered, false, ".other should not be triggered on prehook")
    t.equal(other2PreTriggered, true, ".other2 should be triggered on prehook")
    t.equal(bo, 3)

    t.end()
  })

})


