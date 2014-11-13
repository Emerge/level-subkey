var level = require('level-test')()
var sublevel = require('../')
var tape = require('tape')

require('rimraf').sync('/tmp/test-sublevel-events')

tape('sublevel-events-on-ready', function (t) {


  var db = level('test-sublevel-events')
  var base = sublevel(db)
  var ready = false
  base.once("ready", function(){
      ready = true
      t.equal(ready, true)
      t.end()
  })
  tape("on-close", function(t){
      t.equal(base.isOpen(), true)
      /* if db.db just use the leveldown.batch, so no 'batch' event.
      var count = 0, oc=0
      base.on("batch", function(k, v){
          count++
      })
      base.once("batch", function(k, v){
          oc++
      })
      base.put("k1", "v1", function(err){
          console.log("put")
          if (err) throw err
          base.put("k2", "v2", function(err){
              if (err) throw err
              base.get("k2", function(err, v){
                  t.equal(count, 2)
                  t.equal(oc, 1)
                  db.close()
              })
          })
      })
      //*/
      var closing = false
      base.on("closing", function(){
          closing = true
      })
      base.on("closed", function(){
          t.equal(closing, true)
          t.end()
      })
      db.close()
  })
})
