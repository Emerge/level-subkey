# level-subkey

The level-subkey is modified from [level-sublevel](https://github.com/dominictarr/level-sublevel).

The level-subkey use the path to separate sections of levelup, with hooks!
these sublevels are called dynamic subkey.

[![build status](https://secure.travis-ci.org/snowyu/level-subkey.png)](https://travis-ci.org/snowyu/level-subkey)

[![testling badge](https://ci.testling.com/snowyu/level-subkey.png)](https://ci.testling.com/snowyu/level-subkey)

This module allows you to create a hierarchy data store with
[levelup](https://github.com/rvagg/node-levelup) database,
kinda like tables in an sql database, but hierarchical, evented, and ranged,
for real-time changing data.

## Main Features different from level-sublevel

* dynamic sublevels via key path
* the keys are _encoded_ has changed, and _this means
you cannot run level-subkey on a database you created with level-sublevel
* hierarchy data store like path now.
* rename options.prefix to options.path
  * the path can be a sublevel object, a key path string, or a path array.
  * mark the options.prefix deprecated.
* rename sublevel.prefix() to sublevel.pathAsArray()
  * mark the sublevel.prefix() deprecated.
* rename sublevel.sublevel() to sublevel.subkey()
  * mark the sublevel.sublevel() deprecated.
+ sublevel.path() return this sublevel key path.
  * the sublevel.path and options.path are always absolute key path.
+ sublevel.path(aPath) return a new subkey object(same as subkey()).
+ options.absoluteKey: if true return the key as absolute key path.
+ sublevel.subkeys()
+ minimatch supports for hook and search.
* the subkey must be escaped the PATH\_SEP by youself.
* the hooks match key use wildchar(see minimatch) now.
* remove the sublevels attributes and just cache all subkey objects into nut. no memory leak any more after free().
  + add the sublevels property getter and setter to keep compatibility.
+ can filter in the stream.
  * options.filter = function(key, value) return
    *  0(nut.FILTER_INCLUDED): include this item
    *  1(nut.FILTER_EXCLUDED): exclude
    * -1(nut.FILTER_STOPPED): stop stream.
  * note: the filter parameters key and value may be null, it is affected via keys and values of options.
+ supports subkey uses other separators, and you can change the default keys separator
  * the '%' can not be used as separator, it is the escape char.
  * the default subkey's separator is "#" if no any separator provided.
  * the others can have the subkeys too:
    * '/path/key/.attribute/#subkey'
    * optimalize performance for searching, use the new SUBKEY_SEPS design.
  * usage:

        var precodec = require('sublevel/codec')
        precodec.SUBKEY_SEPS = ["/|-", "#.+"] //the first char is the default subkey separator, others are customize separator. 
        subkey.put("some", "value", {separator: '|'})
        //list all key/value on separator "|"
        subkey.createReadStream({separator: '.'})
        //it will return all prefixed "|" keys: {key: "|abc", value:....}
+ createWriteStream supports
  * Note: the writeStream do not support the options.path, options.separator parameters.
* [bug] fixed the hooks may be memory leak when free sublevel.
  * https://github.com/dominictarr/level-sublevel/issues/38
  * subkey.free() will deregister hooks and free all subkeys of itself.
* readStream
  + bounded(boolean, default is true) option to options: whether limit the boundary of the data.
  + separatorRaw(boolean, default: false): do not convert the separator, use this separator directly if true.
    in fact the pathStream is set the options to {separator:'/', separatorRaw: true, start:'0'} simply.
+ createPathStream/pathStream
  * the path includes the sublevels only(keys are excluded).
* readStream/pathStream
  + the "last" event, this event will return the last raw key(hasnt be decoded).
    * the last return undefined if no more data.
  + the next option on options, this is a raw key ensure the readStream/pathStream return keys is greater than the key.
    * note: use this will replace the gt or lt(reverse) option.
* prehook 
  + when add a key in pre hook, the new triggerBefore/triggerAfter options can disable trigger the added key to prevent the endless loop.
  * join separator before precodec.encode on the operation, using prefix separator always if the key is string.
+ parent() function to Subkey
  * get the latest parent of the subkey.
+ free() function to Subkey
  * free the hooks on the subkey
  * free all the subkeys of itself(freeSubkeys).
+ name/fullName attributes to Subkey
  * the name means the path.basename(fullName)
  * the full name means the key path. fullName = path()
* Subkey is inherited from InterfacedObject now
+ init/final methods on Subkey
  * these are always called on constructor/destroy.
* setPath() would change instance to another subkey.
  * it would not be cached on nut if setPath(): remove it from nut first.
  * it will try destroy first, then re-init again.
* sublevel.subkey(aKeyName, options)
  + addRef: boolean, default is true, whether addRef() if cached.
  + forceCreate: boolean, default is false, whether create a new subkey always instead of retreiving from cache.
+ destroy event on Subkey
  * it will be trigger when subkey.free()
+ alias(keyPath, alias, callback)
  * set an alias to aKeyPath
  * if db has alias method then use it, or use the K/V one.
  * the K/V alias' value getter:
    * the opts.allowRedirect > 0
    * the value encoding should be JSON and value starts with "/" means it's a alias
    * return the alias key string if disallow redirect.
  + alias(alias, callback): create a alias for this subkey.
+ subkey.get([options], callback) to get itself value.

## todo

+ index the integer and json object key on some subkey.
  * mechanism:1
    + customize precodec in subkey()'s options
      + codec option: bytewise
    + store the ".codec" attribute to subkey.
    * disadvantage: performance down
    * advantage: more flexible codec.
  * mechanism:2
    * extent the current codec to support index integer and json object
    * advantage: .
    * disadvantage: performance down a little, key human-readable down a little.
      * the integer and json object can not be readable.
+ LRU-cache supports
  + cache option(boolean, default: true)


## Main Concepts

The key is always string only unless it's an index.

* Key Path
* Key
* Key attributes
* Value
  * the value is json object format currently.


## Stability

Unstable: Expect patches and features, possible api changes.

This module is working well, but may change in the future as its use is further explored.

## Internal Storage Format for Key

The internal key path storage like file path, but the path separator can be customize.

+ supports subkey uses other separators, and you can change the default keys separator
  * the '%' can not be used as separator, it is the escape char.
  * the default subkey's separator is "#" if no any separator provided.
  * the others can have the subkeys too:
    * '/path/key/.attribute/#subkey'
    * optimalize performance for searching, use the new SUBKEY_SEPS design.
* customize usage:

``` js
    var precodec = require('sublevel/codec')
    precodec.SUBKEY_SEPS = ["/|-", "#.+"] //the first char is the default subkey separator, others are customize separator. 
    sublevel.put("some", "value", {separator: '|'})
    //list all key/value on separator "|"
    sublevel.createReadStream({separator: '.'})
    //it will return all prefixed "|" keys: {key: "|abc", value:....}
```

* the default SUBKEY_SEPS is ['/.!', '#\*&']

``` js
var stuff = db.subkey('stuff')
var animal = stuff.subkey('animal')
var plant = stuff.subkey('plant')

animal.put("pig", value, function () {})
// stored raw key is : "/stuff/animal#pig"
// decoded key is: "/stuff/animal/pig"
animal.put("../plant/cucumber", value, function (err) {})
// stored raw key is : "/stuff/plant#cucumber"
// decoded key is: "/stuff/animal/cucumber"
db.put("/stuff/animal/pig/.mouth", value, function(err){})
// stored raw key is : "/stuff/animal/pig*mouth"
// decoded key is: "/stuff/animal/pig/.mouth"
db.put("/stuff/animal/pig/.ear", value, function(err){})
// stored raw key is : "/stuff/animal/pig*ear"
// decoded key is: "/stuff/animal/pig/.ear"
db.put("/stuff/animal/pig/.ear/.type", value, function(err){})
// stored raw key is : "/stuff/animal/pig/.ear*type"
// decoded key is: "/stuff/animal/pig/.ear/.type"

```

## Example


### Simple Section Usage

``` js
var LevelUp = require('levelup')
var Subkey = require('level-subkey')

var db = Subkey(LevelUp('/tmp/sublevel-example'))
var stuff = db.subkey('stuff')

//put a key into the main levelup
db.put(key, value, function () {})

//put a key into the sub-section!
stuff.put(key2, value, function () {})
```

Sublevel prefixes each subsection so that it will not collide
with the outer db when saving or reading!

### hierarchy data store usage

``` js
var LevelUp = require('levelup')
var Subkey = require('level-subkey')

var db = Subkey(LevelUp('/tmp/sublevel-example'))

//old sublevel usage:
var stuff = db.subkey('stuff')      //or stuff = db.path('stuff')
var animal = stuff.subkey('animal') //or animal = stuff.path('animal')
var plant = stuff.subkey('plant')

//put a key into animal!
animal.put("pig", value, function () {})

//new dynamic hierarchy data storage usage:
animal.put("../plant/cucumber", value, function (err) {})
db.put("/stuff/animal/pig", value, function(err){})
db.get("/stuff/animal/pig", function(err, value){})

//put pig's attribute as key/value
db.put("/stuff/animal/pig/.mouth", value, function(err){})
db.put("/stuff/animal/pig/.ear", value, function(err){})

//list all pig's attributes
db.createReadStream({path: "/stuff/animal/pig", separator="."})
//return: {".mouth":value, ".ear":value}

//list all pig's path(excludes the subkeys)
//it will search from "/stuff/\x00" to "/stuff/\uffff"
db.createPathStream({path: "/stuff"}) //= db.createReadStream({separator:'/', separatorRaw: true, start:'0'})
//return:{ 'animal/pig': value, 'animal/pig.ear': value, 'animal/pig.mouth': value, 'plant/cucumber': value}


//list all keys in "/stuff/animal"
db.createReadStream({path: "/stuff/animal"})

//list all keys in "/stuff/plant"
animal.createReadStream({start: "../plant"})


//write by stream
var wsAnimal = animal.createWriteStream()
wsAnimal.on('err', function(err){throw err})
wsAnimal.on('close', function(){})
wsAnimal.write({key: "cow", value:value})
wsAnimal.write({key: "/stuff/animal/cow", value:value})
wsAnimal.write({key: "../plant/tomato", value:value})
wsAnimal.end()

//crazy usage:
//the path will always be absolute key path.
//Warning: setPath will be broken the subkeys cache on nut!!
//  if setPath it will remove itself from cache.
animal.setPath("/stuff/plant")
animal.setPath(plant)
//now the "animal" is plant in fact.
animal.get("cucumber", function(err, value){})

```


## Hooks

Hooks are specially built into Sublevel so that you can 
do all sorts of clever stuff, like generating views or
logs when records are inserted!

Records added via hooks will be atomically inserted with the triggering change.


### db.pre/post()

1. subkey.pre(function(op, add))
2. subkey.pre(aKeyPattern, function(op, add))
3. subkey.pre(aRangeObject, function(op, add))

```js
//you should be careful of using the add() function
//maybe endless loop in it. u can disable the trigger
add({
    key:...,
    value:...,
    type:'put' or 'del',
    triggerBefore: false, //defalut is true. whether trigger this key on pre hook.
    triggerAfter: false   //defalut is true. whether trigger this key on post hook.
 
})
add(false): abondon this operation(remove it from the batch).
```

### Hooks Example

Whenever a record is inserted,
save an index to it by the time it was inserted.

``` js
var sub = db.subkey('SEQ')

db.pre(function (ch, add) {
  add({
    key: ''+Date.now(), 
    value: ch.key, 
    type: 'put',
    // NOTE: pass the destination db to add the value to that subsection!
    path: sub
  })
})

db.put('key', 'VALUE', function (err) {
  // read all the records inserted by the hook!
  sub.createReadStream().on('data', console.log)
})
```

Notice that the `parent` property to `add()` is set to `sub`, which tells the hook to save the new record in the `sub` section.

### Hooks Another Example

``` js
var sub = db.subkey('SEQ')

//Hooks range 
db.pre({gte:"", lte:"", path:""}, function (ch, add) {
  add({
    key: ''+Date.now(), 
    value: ch.key, 
    type: 'put',
    // NOTE: pass the destination db to add the value to that subsection!
    path: sub
  })
})

//hooks a key, and the key can be relative or absolute key path and minimatch supports.
db.pre("a*", function (ch, add) {
  //NOTE: add(false) means do not put this key into storage.
  add({
    key: ''+Date.now(), 
    value: ch.key, 
    type: 'put',
    // NOTE: pass the destination db to add the value to that subsection!
    path: sub
  })
})
```

## Batches

In `sublevel` batches also support a `prefix: subdb` property,
if set, this row will be inserted into that database section,
instead of the current section, similar to the `pre` hook above.

``` js
var sub1 = db.subkey('SUB_1')
var sub2 = db.subkey('SUB_2')

sub2.batch([
  {key: 'key', value: 'Value', type: 'put'},
  {key: 'key', value: 'Value', type: 'put', path: sub2},
  {key: '../SUB_1/key', value: 'Value', type: 'put', path: sub2},
], function (err) {...})
```

## License

MIT

