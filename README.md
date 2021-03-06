# level-subkey

The level-subkey is modified from [level-sublevel](https://github.com/dominictarr/level-sublevel).

The level-subkey use the path to separate sections of levelup, with hooks!
these sublevels are called dynamic subkey.

[![build status](https://secure.travis-ci.org/snowyu/level-subkey.png)](https://travis-ci.org/snowyu/level-subkey)

[![NPM](https://nodei.co/npm/level-subkey.png?stars&downloads&downloadRank)](https://nodei.co/npm/level-subkey/) [![NPM](https://nodei.co/npm-dl/level-subkey.png?months=6&height=3)](https://nodei.co/npm/level-subkey/)

This module allows you to create a hierarchy data store with
[levelup-sync](https://github.com/snowyu/node-levelup-sync) database,
kinda like tables in an sql database, but hierarchical, evented, and ranged,
for real-time changing data.

## Main Features different from level-sublevel

* dynamic sublevels via key path
* the keys are _encoded_ has changed, and _this_ means
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
    *  0(subkey.FILTER_INCLUDED): include this item
    *  1(subkey.FILTER_EXCLUDED): exclude
    * -1(subkey.FILTER_STOPPED): stop stream.
  * note: the filter parameters key and value may be null, it is affected via keys and values of options.
+ supports subkey uses other separators, and you can change the default keys separator
  * the '%' can not be used as separator, it is the escape char.
  * the default subkey's separator is "#" if no any separator provided.
  * the others can have the subkeys too:
    * '/path/key/.attribute/#subkey'
    * optimalize performance for searching, use the new SUBKEY_SEPS design.
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
  * the K/V alias real value to get:
    * the opts.allowRedirect > 0
    * the value encoding should be JSON and value starts with "/" means it's a redirected key.
    * return the redirected key string if redirect count limit exceeded.
  * the K/V alias real key to get:
    * the opts.getRealKey = true
    * the default opts.allowRedirect is 6 if no setting allowRedirect
    * the value encoding should be JSON and value starts with "/" means it's a redirected key.
    * throw error if redirect count limit exceeded.
  + alias(alias, callback): create a alias for this subkey.
    * Alias Process Way
      * transparent alias: all operations on an alias will be passed to the real key.
        * get/put/batch/alias/readStream/writeStream are passed to the real key.
        * the post/pre hook is not passed.
        * the del itself is not passed.
      * subkey._value is the original the value of the key(alias point ot the another key).
      * subkey.value is the real value:
        * value = if @_realKey? then @_realKey._value else @_value
+ loading state
+ subkey.get([options], callback) to get itself value.
* the valueEncoding and keyEncoding should not change on the same subkey.
* you must escape the PATH_SEP for the first char(it as mark the redirection/alias key) if the valueEncoding is string(utf8)
+ Class property to get Subkey Class.
* the Subkey instance lifecycle state manage.
 * object state(_obj_state):
   * initing: the object is initing.
   * inited: the object is created.
   * destroying: the object is destroying(before destroy).
   * destroyed: the object is destroyed(after destroy). the destroyed event will be emitted.
 * object loading state(_loading_state):
   * unload: the object is not loaded from database.
   * loading: the object is loading from database.
   * loaded: the object has already been loaded from database.
     * dirtied: the object has been modified, but not saved to database yet.
       * triggered the dirtied event, the operation is an object item(see batch): {type:"put", key:keyName, value:value}
         on "dirtied", (keyObj, operation)->
     * modifying: the object has been modified to database, but not loaded to the object(affect the loading state to loading)
     * modified: the object has been modified to database(not affect the loading state).
     * deleted: the object has been deleted from database(affect the object state to destroyed).
* async problem:
  * sync is very simple.
  * a = subkey("mykey") //the nut will cache this key.
  * b = subkey("mykey", function(err, theKey){})
  * the nut.createSubkey must change to async too.

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
+ LRU-cache object supports
  + cache option(boolean, default: true)


## Main Concepts

The key is always string only unless it's an index.

* Key
  * Key Path: like hierarchical file path.
  * Subkey: a key can have a lot of subkeys.
  * alias
* Value
  * can not be undefined, it used as deleted.
  * can be null.
  * get {asBuffer: false} can improve performance for leveldown.
* Attributes(V9)
  * the key has many attributes(not a lot)
  * the value is a special attribute too.

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
    var precodec = require('level-subkey/lib/codec')
    precodec.SUBKEY_SEPS = ["/|-", "#.+"] //the first char is the default subkey separator, others are customize separator. 
    subkey.put("some", "value", {separator: '|'})
    //list all key/value on separator "|"
    subkey.createReadStream({separator: '.'})
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

## API

### Subkey.subkey()/path(keyPath)

Create(or get from a global cache) a new Subkey instance,
and load the value if this key is exists on the database

* Subkey.subkey(keyPath, options, readyCallback)
  * = Subkey.path(keyPath, options, readyCallback)
* Subkey.subkey(keyPath, readyCallback)
  * = Subkey.path(keyPath, readyCallback)


__arguments__

* keyPath: the key path can be a relative or absolute path.
* options: the options object is optional.
  * loadValue: boolean, defalut is true. whether load the value of the key after the key is created.
  * forceCreate: boolean, defalut is false. whether ignore the global cache always create a new Subkey instance.
    which means it will bypass the global cache if it is true.
  * addRef: boolean, defalut is true. whether add a reference count to the key instance in the global cache.
    * only free when RefCount is less than zero.
* readyCallback: triggered when loading finished.
  * function readyCallback(err, theKey)
    * theKey may be set even though the error occur

__return__

* object: the Subkey instance object


The usages:

* Isolate the key like data tables, see also [level-sublevel](https://github.com/dominictarr/level-sublevel).
* Key/Value ORM: Mapping the Key/Value to an Object with subkeys supports.
* Hierarchical Key/Value Storage


## Subkey.fullName/path()

* Subkey.fullName
* Subkey.path()

__arguments__

* None

__return__

* String: return the subkey's full path.

## Subkey.isAlias()

Get the subkey itself whether is an alias or not.

__arguments__

* none

__return__

* return: boolean, the subkey itself whether is an alias or not.


## Subkey.alias()

Create an alias for the keyPath:

* Subkey.alias(keyPath, alias, callback)

Create an alias for itself:

* Subkey.alias(alias, callback)
 
__arguments__

* keyPath: the key path can be a relative or absolute path.
* alias: the created alias key path.
* callback: 
  * function callback(err)

__return__

* return: undefined


## Subkey.readStream/createReadStream([options])

create a read stream to visit the child subkeys of this subkey.

* Subkey.readStream()
* Subkey.readStream(options)

__arguments__

* options: this options object is optional argument.
  * subkey's options
    * `'path'` *(string|Subkey Object)*: can be relative or absolute key path or another subkey object to search
    * `'next'`: the raw key data to ensure the readStream/pathStream return keys is greater than the key. See `'last'` event.
      * note: this will affect the gt/gte or lt/lte(reverse) options.
    * `'separator'` *(char)*
    * `'filter'` *(function)*: to filter data in the stream
      * function filter(key, value) if return:
        *  0(subkey.FILTER_INCLUDED): include this item
        *  1(subkey.FILTER_EXCLUDED): exclude
        * -1(subkey.FILTER_STOPPED): stop stream.
      * note: the filter function argument 'key' and 'value' may be null, it is affected via keys and values of this options.
    * `'bounded'` *(boolean, default: `true`)*: whether limit the boundary to this subkey only.
      * through that can limit all keys are the subkey's children. So DONT disable it unless you know why.
    * `'separatorRaw'` *(boolean, default: `false`)*: do not convert the separator, use the separator directly if true.
      * see also: 'Internal Storage Format for Key'
      * in fact the pathStream is set the options to {separator:'/', separatorRaw: true, start:'0'} simply.
  * levelup's options
    *  'lt', 'lte', 'gt', 'gte', 'start', 'end', 'reverse' options to control the range of keys that are streamed 
      * see [Levelup](https://github.com/rvagg/node-levelup#createReadStream)
    * `'keys'` *(boolean, default: `true`)*: whether the `'data'` event should contain keys. If set to `true` and `'values'` set to `false` then `'data'` events will simply be keys, rather than objects with a `'key'` property. Used internally by the `createKeyStream()` method.
    * `'values'` *(boolean, default: `true`)*: whether the `'data'` event should contain values. If set to `true` and `'keys'` set to `false` then `'data'` events will simply be values, rather than objects with a `'value'` property. Used internally by the `createValueStream()` method.
    * `'limit'` *(number, default: `-1`)*: limit the number of results collected by this stream. This number represents a *maximum* number of results and may not be reached if you get to the end of the data first. A value of `-1` means there is no limit. When `reverse=true` the highest keys will be returned instead of the lowest keys.
    * `'fillCache'` *(boolean, default: `false`)*: wheather LevelDB's LRU-cache should be filled with data read.

__return__

* object: the read stream object


the standard `'data'`, '`error'`, `'end'` and `'close'` events are emitted.
the `'last'` event will be emitted when the last data arrived, the argument is the last raw key(no decoded).
if no more data the last key is `undefined`.


### Examples


filter usage:

```js
db.createReadStream({filter: function(key, value){
    if (/^hit/.test(key))
        return db.FILTER_INCLUDED
    else key == 'endStream'
        return db.FILTER_STOPPED
    else
        return db.FILTER_EXCLUDED
}})
  .on('data', function (data) {
    console.log(data.key, '=', data.value)
  })
  .on('error', function (err) {
    console.log('Oh my!', err)
  })
  .on('close', function () {
    console.log('Stream closed')
  })
  .on('end', function () {
    console.log('Stream closed')
  })
```

next and last usage for paged data demo:

``` js

var callbackStream = require('callback-stream')

var lastKey = null;

function nextPage(db, aLastKey, aPageSize, cb) {
  var stream = db.readStream({next: aLastKey, limit: aPageSize})
  stream.on('last', function(aLastKey){
    lastKey = aLastKey;
  });

  stream.pipe(callbackStream(function(err, data){
    cb(data, lastKey)
  }))

}

var pageNo = 1;
dataCallback = function(data, lastKey) {
    console.log("page:", pageNo);
    console.log(data);
    ++pageNo;
    if (lastKey) {
      nextPage(db, lastKey, 10, dataCallback);
    }
    else
      console.log("no more data");
}
nextPage(db, lastKey, 10, dataCallback);
```

## Examples


### Simple Section Usage

``` js
var LevelUp = require('levelup')
var Subkey = require('level-subkey')

var db = Subkey(LevelUp('/tmp/sublevel-example'))
var stuff = db.subkey('stuff')
//it is same as stuff = db.sublevel('stuff')  but db.sublevel is deprecated.

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

