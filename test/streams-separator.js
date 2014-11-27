var level = require('level-test')()
var path  = require("path")
var sublevel = require('../')
var precodec = require('../lib/codec')

var _nut = require('../lib/DBCore')
var tape = require('tape')

var FILTER_EXCLUDED = _nut.FILTER_EXCLUDED
var FILTER_STOPPED = _nut.FILTER_STOPPED
var getPathArray = _nut.getPathArray
var resolveKeyPath = _nut.resolveKeyPath
var pathArrayToPath = _nut.pathArrayToPath
var pathToPathArray = _nut.pathToPathArray
var SUBKEY_SEPS = precodec.SUBKEY_SEPS
var encode = precodec.encode
var SEP1 = SUBKEY_SEPS[0][1]
var SEP2 = SUBKEY_SEPS[0][2]
var SEP22= SUBKEY_SEPS[1][2]

require('rimraf').sync('/tmp/test-sublevel-readstream-separator')

var db = level('test-sublevel-readstream-separator')
var base = sublevel(db)

var a    = base.subkey('A')
var b    = base.subkey('B')
var stuff= base.subkey('stuff')

function encodeKey(s, separator) {
    var p = path.dirname(s), k=path.basename(s)
    p = [pathToPathArray(p)]
    p.push(k)
    if (separator) p.push(separator)
    return encode(p)
}

  function all(db, opts, cb) {
    var o
    opts = opts || {}
    if (!opts.end) opts.end = '\uffff'
    db.createReadStream(opts).on('data', function (data) {
      if (data.key) {
          if(!o) o={}
          o[data.key.toString()] = data.value.toString()
      }
      else {
        if (!o) o = []
        o.push(data)
      }
    })
    .on('end', function () {
      cb(null, o)
    })
    .on('error', cb)
  }

  var _a='AAA_'+Math.random(), _b= 'BBB_'+Math.random(), _c= 'CCC_'+Math.random()
  var _d = "DDD_2333"

function filterEmpty(key, value)  {
    //console.log("fe=", key)
}

var expectedResults = {}
expectedResults[encodeKey('/.attr')] = _c
expectedResults[encodeKey('/.参数')] = _c
expectedResults[encodeKey('/A/3.cKey')] = _c
expectedResults[encodeKey('/A/3.cKey')] = _c
expectedResults[encodeKey('/A/d4')] = _d+"4"
expectedResults[encodeKey('/A/d5')] = _d+"5"
expectedResults[encodeKey('/A/z6')] = _d+"6"
expectedResults[encodeKey('/A/.1.a')] = _a
expectedResults[encodeKey('/A/.2.b', '.')] = _b
expectedResults[encodeKey('/A/.3.c', '.')] = _c
expectedResults[encodeKey('/A/.3.d', '.')] = _d
expectedResults[encodeKey('/B/.3.e', '.')] = _d
expectedResults[encodeKey('/A/.3.c/abc')] = _c
expectedResults[encodeKey('/A/'+SEP2+'a', '')] = _d+"7"
expectedResults[encodeKey('/A/'+SEP2+'b')] = _d+"8"
expectedResults[encodeKey('/A/B/123')] = _c
expectedResults[encodeKey('/A/plan/ahello')] = _c
expectedResults[encodeKey('/A/0/13/nest/aw')] = _c
expectedResults[encodeKey('/stuff/animal/pig')] = _c
expectedResults[encodeKey('/stuff/animal/pig/.mouth')] = _c
expectedResults[encodeKey('/stuff/animal/pig/.ear')] = _c
expectedResults[encodeKey('/stuff/plant/cucumber')] = _c

tape('stream-separator-init', function (t) {

console.log(expectedResults)
  var i = 0



  function filter(key, value) {
      console.log("f:", key, " v:", value)
      if (key.indexOf(".") < 0) return FILTER_EXCLUDED //return true to stop.
  }

  function filterEnd(key, value) {
      console.log("f:", key, " v:", value)
      if (key == "d5") return FILTER_STOPPED //return true to stop.
  }

  a.batch([
    {key: '/.attr', value: _c , type: 'put'},
    {key: '/.参数', value: _c , type: 'put', separator: '.'},
    {key: '1.a', value: _a , type: 'put', separator: '.'},
    {key: '2.b', value: _b , type: 'put', separator: '.'},
    {key: '3.c', value: _c , type: 'put', separator: '.'},
    {key: '3.d', value: _d , type: 'put', separator: '.'},
    {key: '.3.e', value: _d , type: 'put', separator: '.', path: '/B'},
    {key: '3.cKey', value: _c , type: 'put'},
    {key: 'd4', value: _d+"4" , type: 'put'},
    {key: 'd5', value: _d+"5" , type: 'put'},
    {key: 'z6', value: _d+"6" , type: 'put'},
    {key: 'abc', value: _c , type: 'put', path: "A/.3.c"},
    {key: SEP2+'a', value: _d+"7" , type: 'put'},
    {key: SEP2+'b', value: _d+"8" , type: 'put'},
    {key: '123', value: _c , type: 'put', path: "A/B"},
    {key: 'ahello', value: _c , type: 'put', path: "A/plan"},
    {key: 'aw', value: _c , type: 'put', path: "A/0/13/nest"},
    {key: '/stuff/animal/pig', value: _c , type: 'put'},
    {key: '/stuff/plant/cucumber', value: _c , type: 'put'},
    {key: '/stuff/animal/pig/.mouth', value: _c , type: 'put'},
    {key: '/stuff/animal/pig/.ear', value: _c , type: 'put'},
  ], function (err) {
    if(err) throw err
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
 
        all(a, {}, function (err, obj) {
          if(err) throw err
          t.deepEqual(obj, 
            {
              '3.cKey': _c,
              'd4': _d+"4",
              'd5': _d+"5",
              'z6': _d+"6"
            })

          t.end()
        })
    })
  })
})

tape('stream-separator', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(a, {separator:'.', filter: filterEmpty}, function (err, obj) {
          if(err) throw err
            console.log(obj)
          t.deepEqual(obj, 
            {
              '.1.a': _a,
              '.2.b': _b,
              '.3.c': _c,
              '.3.d': _d
            })

          t.end()
        })
    })
})

tape('stream-path', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(b, {path:'/A', separator:'.'}, function (err, obj) {
          if(err) throw err
            console.log(obj)
          t.deepEqual(obj, 
            {
              '.1.a': _a,
              '.2.b': _b,
              '.3.c': _c,
              '.3.d': _d
            })

          t.end()
        })
    })
})

tape('stream-path2', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(b, {path:'/A', separator:SEP2}, function (err, obj) {
          if(err) throw err
            console.log(obj)
            o = {}
            o[SEP2+'a'] = _d+"7"
            o[SEP2+'b'] = _d+"8"
          t.deepEqual(obj, o)

          t.end()
        })
    })
})

tape('stream-path-separatorRaw', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(b, {path:'/A', separator:SEP22, separatorRaw: true}, function (err, obj) {
          if(err) throw err
            console.log(obj)
            o = {}
            o[SEP2+'a'] = _d+"7"
            o[SEP2+'b'] = _d+"8"
          t.deepEqual(obj, o)


          t.end()
        })
    })
})

tape('stream-path-separatorRaw-start', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(b, {path:'/A', separator:'/', separatorRaw: true, start:'0'}, function (err, obj) {
          if(err) throw err
          console.log(obj)
          t.deepEqual(obj, 
            { '0/13/nest/aw': _c, 'B/123': _c, 'plan/ahello': _c }
          )

            all(a, {separator:'/', separatorRaw: true, start:'0'}, function (err, obj) {
              if(err) throw err
              console.log(obj)
              t.deepEqual(obj, 
                { '0/13/nest/aw': _c, 'B/123': _c, 'plan/ahello': _c }
              )

              t.end()
            })
        })
    })
})

tape('stream-path-separatorRaw-start2', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(b, {path:'/stuff', separator:'/', separatorRaw: true, start:'0'}, function (err, obj) {
          if(err) throw err
          console.log(obj)
          t.deepEqual(obj, 
                { 'animal/pig': _c, 'animal/pig.ear': _c, 'animal/pig.mouth': _c, 'plant/cucumber': _c}
          )

            all(stuff, {separator:'/', separatorRaw: true, start:'0'}, function (err, obj) {
              if(err) throw err
              console.log(obj)
              t.deepEqual(obj, 
                { 'animal/pig': _c, 'animal/pig.ear': _c, 'animal/pig.mouth': _c, 'plant/cucumber': _c}
              )

                all(stuff, {path:"animal", separator:'/', separatorRaw: true, start:'0'}, function (err, obj) {
                  if(err) throw err
                  console.log(obj)
                  t.deepEqual(obj, 
                    { 'pig.ear': _c, 'pig.mouth': _c}
                  )
                  t.end()
                })
            })
        })
    })
})

tape('stream-path-separator-root', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(b, {path:'/', separator:'.'}, function (err, obj) {
          if(err) throw err
            console.log(obj)
            o = {}
            o['.attr'] = _c
            o['.参数'] = _c
          t.deepEqual(obj, o)


          t.end()
        })
    })
})

tape('stream-root-separator', function (t) {
    all(db, {}, function (err, obj) {
      if(err) throw err
      t.deepEqual(obj, expectedResults)
        all(base, {separator:'.'}, function (err, obj) {
          if(err) throw err
            console.log(obj)
            o = {}
            o['.attr'] = _c
            o['.参数'] = _c
          t.deepEqual(obj, o)


          t.end()
        })
    })
})

  var dataOps = [
        {
          type: "put",
          key: "/科目不包括/飞机",
          value: ""
        }, {
          type: "put",
          key: "/科目/.名称",
          value: ""
        }, {
          type: "put",
          key: "/科目/!XX",
          value: ""
        }, {
          type: "put",
          key: "/科目/飞机",
          value: ""
        }, {
          type: "put",
          key: "/科目/飞机/.轮子",
          value: ""
        }, {
          type: "put",
          key: "/科目/飞机/.盘子",
          value: ""
        }, {
          type: "put",
          key: "/科目/飞机/客机",
          value: ""
        }, {
          type: "put",
          key: "/科目/飞机/战斗机",
          value: ""
        }, {
          type: "put",
          key: "/科目/大盘",
          value: ""
        }, {
          type: "put",
          key: "/科目/飞碟",
          value: ""
        }, {
          type: "put",
          key: "/科目/大炮",
          value: ""
        }
      ].map(function(i){
          i.value = "abc"
          return i
      });
tape('pathStream-init', function (t) {
   base.batch(dataOps, function(err){
       if (err) throw err
       t.end()
   });
})

tape('pathStream', function (t) {
    var result = null
    base.pathStream({path:'科目',limit:1,values:false}).on("data", function(item){
        result = true
    }).on('error', function(err){
      if(err) throw err
    }).on('end', function(){
        t.strictEqual(result, true)
        t.end()
    })
})
