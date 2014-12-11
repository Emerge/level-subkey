EventEmitter  = require("events").EventEmitter
util          = require("./util")

inherits      = util.inherits


# InterfacedObject with RefCount and AddRef/Release Supports.
# class should overwrite the destroy method.
# the default destroy method just send "destroy" notification.
#
# * release/free: Decrements reference count for this instance. 
#   If it is becoming <0 object is (self) destroyed. 
# * addRef: Increments the reference count for this instance
#   and returns the new reference count.


# the object state constants:
OBJECT_STATES =
  initing: 1
  inited: 2
  destroying: 0
  destroyed: null


module.exports = class InterfacedObject
  inherits InterfacedObject, EventEmitter
  OBJECT_STATES: OBJECT_STATES
  @.prototype.__defineGetter__ "objectState", ->
    vState = @_objectState_
    if not vState? then "destroyed" else ["destroying", "initing", "inited"][vState]
  setObjectState: (value, emitted = true)->
    @_objectState_ = OBJECT_STATES[value]
    @emit value, @ if emitted
    return
  # abstract initialization method
  init: ->
  # abstract finalization method
  final:->
  chageObjectStateTo: (aState)->
  constructor: ->
    @setObjectState "initing"
    @RefCount = 0
    @setMaxListeners(Infinity)
    @init.apply @, arguments
    @setObjectState "inited"
  addRef: ->
    ++@RefCount
  destroy: ->
    @setObjectState "destroying"
    @emit "destroying", @
    @final()
    @setObjectState "destroyed"
  release: ->
    result = --@RefCount
    @destroy() if result < 0
    result
  free: InterfacedObject.prototype.release

