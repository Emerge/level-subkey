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


module.exports = class InterfacedObject
  inherits InterfacedObject, EventEmitter
  constructor: ->
    @RefCount = 0
    @setMaxListeners(Infinity)
  addRef: ->
    ++@RefCount
  destroy: ->
    @emit "destroy", @
  release: ->
    result = --@RefCount
    @destroy() if result < 0
    result
  free: InterfacedObject.prototype.release

