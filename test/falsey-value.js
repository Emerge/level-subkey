var tape     = require('tape')
var sublevel = require('../index')
var level    = require('level-test-sync')()

var falsies = [
  0, null, false, ''
]

var names = [
  'zero', 'null', 'false', 'emptystring'
]

var db = sublevel(
  level('level-sublevel-falsey', {valueEncoding: 'json', keyEncoding: 'json'})
)

falsies.forEach(function (falsey, i) {

  tape('allow falsey value:' + JSON.stringify(falsey),
    function (t) {

      db.put('foo', falsey, function (err) {
        if(err) throw err
        db.get('foo', function (err, value) {
          t.deepEqual(value, falsey)
          t.end()
        })
      })
    })

  tape('allow falsey value in key:' + JSON.stringify(falsey), function (t) {
    var sdb = db.subkey(names[i])
    sdb.put(falsey, {index: i}, function (err) {
      if(err) throw err
      sdb.createReadStream({gte: falsey})
        //this will error if the stream returns more than one item
        //which it shouldn't.
        .on('data', function (op) {
          t.equal(op.key, falsey)
          t.deepEqual(op.value, {index: i})
          t.end()
        })
    })
  })
})


