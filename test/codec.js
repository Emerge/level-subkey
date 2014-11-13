var tape = require('tape')
var PATH_SEP = require('../codec').PATH_SEP
var SUBKEY_SEP = require('../codec').SUBKEY_SEP
var SUBKEY_SEPS = require('../codec').SUBKEY_SEPS

var expected = [
  [[], 'foo'],
  [['foo'], 'bar'],
  [['foo', 'bar'], 'baz'],
  [['foo', 'bar'], 'blerg'],
  [['foobar'], 'barbaz'],
]

var expectedDecoded = [
  [[], 'foo', PATH_SEP],
  [['foo'], 'bar', PATH_SEP],
  [['foo', 'bar'], 'baz', PATH_SEP],
  [['foo', 'bar'], 'blerg', PATH_SEP],
  [['foobar'], 'barbaz', PATH_SEP],
]

var others = [
  [[], 'foo', SUBKEY_SEPS[0][1]],
  [['foo'], 'bar', SUBKEY_SEPS[0][1]],
  [['foo', 'bar'], 'baz', SUBKEY_SEPS[0][1]],
  [['foo', 'bar'], 'blerg', SUBKEY_SEPS[0][1]],
  [['foobar'], 'barbaz', SUBKEY_SEPS[0][1]],
]
var othersDecoded = [
  [[], 'foo', PATH_SEP + SUBKEY_SEPS[0][1]],
  [['foo'], 'bar', PATH_SEP + SUBKEY_SEPS[0][1]],
  [['foo', 'bar'], 'baz', PATH_SEP + SUBKEY_SEPS[0][1]],
  [['foo', 'bar'], 'blerg', PATH_SEP + SUBKEY_SEPS[0][1]],
  [['foobar'], 'barbaz', PATH_SEP + SUBKEY_SEPS[0][1]],
]

//compare two array items
function compare (a, b) {
 if(Array.isArray(a) && Array.isArray(b)) {
    var l = Math.min(a.length, b.length)
    for(var i = 0; i < l; i++) {
      var c = compare(a[i], b[i])
      if(c) return c
    }
    return a.length - b.length
  }
  if('string' == typeof a && 'string' == typeof b)
    return a < b ? -1 : a > b ? 1 : 0

  throw new Error('items not comparable:'
    + JSON.stringify(a) + ' ' + JSON.stringify(b))
}

function random () {
  return Math.random() - 0.5
}

module.exports = function (format) {

  var encoded = expected.map(format.encode)

  tape('ordering', function (t) {

    expected.sort(compare)

    var actual =
      expected.slice()
        .sort(random)
        .map(format.encode)
        .sort()
        .map(format.decode)

    console.log(actual)

    t.deepEqual(actual, expectedDecoded)

    t.end()
  })

  tape('orderingOthers', function (t) {

    others.sort(compare)

    var actual =
      others.slice()
        .sort(random)
        .map(format.encode)
        .sort()
        .map(format.decode)

    console.log(actual)

    t.deepEqual(actual, othersDecoded)

    t.end()
  })


  tape('ranges', function (t) {

    function gt  (a, b, i, j) {
      t.equal(a > b,  i > j,  a + ' gt '  + b + '==' + i >  j)
    }

    function gte (a, b, i, j) {
      t.equal(a >= b, i >= j, a + ' gte ' + b + '==' + i >= j)
    }

    function lt  (a, b, i, j) {
      t.equal(a < b,  i < j,  a + ' lt '  + b + '==' + i <  j)
    }

    function lte (a, b, i, j) {
      t.equal(a <= b, i <= j, a + ' lte ' + b + '==' + i <= j)
    }

    function check(j, cmp) {
      var item = encoded[j]
      for(var i = 0; i < expected.length; i++) {
        //first check less than.
        cmp(item, encoded[i], j, i)
      }
    }

    for(var i = 0; i < expected.length; i++) {
      check(i, gt)
      check(i, gte)
      check(i, lt)
      check(i, lte)
    }

    t.end()
  })
  tape('SUBKEY_SEPS', function (t) {
      format.SUBKEY_SEPS = ["/!~", ".$-"]
      t.deepEqual(format.SUBKEY_SEPS, ["/!~", ".$-"])
      t.equal(format.SUBKEY_SEP, ".")
      t.equal(format.escapeString("Hello~world!"), "Hello%7eworld%21")
      t.equal(format.encode([["path"], "Key!ABC", "!"]), '/path/$Key%21ABC')
      t.equal(format.encode([["path"], "KeyABC", "!"]), '/path/$KeyABC')
      t.equal(format.encode([["path"], "!KeyABC", "!"]), '/path/$KeyABC')
      t.equal(format.encode([["path"], "!", "!"]), '/path/$')
      t.equal(format.encode([["path"], "", "!"]), '/path/$')
      t.equal(format.encode([["path"], "key"]), '/path.key')
      t.equal(format.encode([[], "\uffff", '!']), '/$\uffff')
      t.deepEqual(format.decode('/path/Key$ABC'), [["path", "Key"], "ABC", "/!"])
      t.deepEqual(format.decode('/path/Key.ABC'), [["path", "Key"], "ABC", "/"])
      t.end()
  })

}

module.exports(require('../codec'))

