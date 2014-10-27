# level-sublevel

Separate sections of levelup, with hooks!

[![build status](https://secure.travis-ci.org/dominictarr/level-sublevel.png)](http://travis-ci.org/dominictarr/level-sublevel)

[![testling badge](https://ci.testling.com/dominictarr/level-sublevel.png)](https://ci.testling.com/dominictarr/level-sublevel)

This module allows you to create a hierarchy data store with
[levelup](https://github.com/rvagg/node-levelup) database,
kinda like tables in an sql database, but evented, and ranged,
for real-time changing data.

## level-sublevel@7 **BREAKING CHANGES** via Riceball LEE

* dynamic sublevels
* the keys are _encoded_ has changed, and _this means
you cannot run 7 on a database you created with 6_.
* hierarchy data store like path now.
* rename options.prefix to options.path
  * the path can be a sublevel object, a key path string, or a path array.
* rename sublevel.prefix() to sublevel.pathAsArray()
+ sublevel.path() return this sublevel key path.
  * the sublevel.path and options.path are always absolute key path.
+ options.absoluteKey: if true return the key as absolute key path.
+ sublevel.subkeys()
+ minimatch supports for hook and search.
* the subkey must be escaped the PATH\_SEP by youself.
* the hooks match key use wildchar(see minimatch) now.
* merge the "rvagg/special-words" patch to avoid bug and injection.
  + add the sublevels property getter and setter to keep compatibility.

## level-sublevel@6 **BREAKING CHANGES**

The long awaited `level-sublevel` rewrite is out!
You are hearby warned this is a _significant breaking_ change.
So it's good to use it with a new project,
The user api is _mostly_ the same as before,
but the way that keys are _encoded_ has changed, and _this means
you cannot run 6 on a database you created with 5_.

Also, `createWriteStream` has been removed, in anticipation of [this
change](https://github.com/rvagg/node-levelup/pull/207) use something
like [level-write-stream](https://github.com/Raynos/level-write-stream)

### Legacy Mode

Using leveldb with legacy mode is the simplest way to get the new sublevel
on top of a database that used old sublevel. Simply require sublevel like this:

``` js
var level = require('level')
                                   //  V *** require legacy.js ***
var sublevel = require('level-sublevel/legacy')
var db = sublevel(level(path))

```

### Migration Tool

@calvinmetcalf has created a migration tool:
[sublevel-migrate](https://github.com/calvinmetcalf/sublevel-migrate)

This can be used to copy an old level-sublevel into the new format.

## Stability

Unstable: Expect patches and features, possible api changes.

This module is working well, but may change in the future as its use is further explored.

## Example


### Simple Section Usage

``` js
var LevelUp = require('levelup')
var Sublevel = require('level-sublevel')

var db = Sublevel(LevelUp('/tmp/sublevel-example'))
var sub = db.sublevel('stuff')

//put a key into the main levelup
db.put(key, value, function () {})

//put a key into the sub-section!
sub.put(key2, value, function () {})
```

Sublevel prefixes each subsection so that it will not collide
with the outer db when saving or reading!

### hierarchy data store usage

``` js
var LevelUp = require('levelup')
var Sublevel = require('level-sublevel')

var db = Sublevel(LevelUp('/tmp/sublevel-example'))

//old sublevel usage:
var stuff = db.sublevel('stuff')
var animal = stuff.sublevel('animal')
var plant = stuff.Sublevel('plant')

//put a key into animal!
animal.put("pig", value, function () {})

//new dynamic hierarchy data storage usage:
animal.put("../plant/cucumber", value, function (err) {})
db.put("/stuff/animal/pig", value, function(err){})
db.get("/stuff/animal/pig", function(err, value){})

//list all keys in "/stuff/animal" path
db.createReadStream({path: "/stuff/animal"})

//list all keys in "/stuff/plant" path
animal.createReadStream({start: "../plant"})

//crazy usage:
//the path will always be absolute key path.
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

### Hooks Example

Whenever a record is inserted,
save an index to it by the time it was inserted.

``` js
var sub = db.sublevel('SEQ')

db.pre(function (ch, add) {
  add({
    key: ''+Date.now(), 
    value: ch.key, 
    type: 'put',
    // NOTE: pass the destination db to add the value to that subsection!
    parent: sub
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
var sub = db.sublevel('SEQ')

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
var sub1 = db.sublevel('SUB_1')
var sub2 = db.sublevel('SUB_2')

sub.batch([
  {key: 'key', value: 'Value', type: 'put'},
  {key: 'key', value: 'Value', type: 'put', path: sub2},
  {key: '../SUB_1/key', value: 'Value', type: 'put', path: sub2},
], function (err) {...})
```

## License

MIT

