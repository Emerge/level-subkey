var util = module.exports = {
    objectToString: function(o) {
      return Object.prototype.toString.call(o);
    },

    isArray: Array.isArray,

    isBoolean: function(arg) {
      return typeof arg === 'boolean';
    },

    isNullOrUndefined: function(arg) {
      return arg == null;
    },

    isString: function(arg) {
      return typeof arg === 'string';
    },

    isNumber: function(arg) {
      return typeof arg === 'number';
    },

    isUndefined: function(arg) {
      return arg === void 0;
    },

    isObject: function(arg) {
      return arg != null && typeof arg === 'object';
    },

    isFunction: function(arg) {
      return typeof arg === 'function';
    },

    isDate: function(d) {
      return util.isObject(d) && util.objectToString(d) === '[object Date]';
    },

    /**
     * Inherit the prototype methods from one constructor into another.
     *
     *
     * The Function.prototype.inherits from lang.js rewritten as a standalone
     * function (not on Function.prototype). NOTE: If this file is to be loaded
     * during bootstrapping this function needs to be rewritten using some native
     * functions as prototype setup using normal JavaScript does not work as
     * expected during bootstrapping (see mirror.js in r114903).
     *
     * @param {function} ctor Constructor function which needs to inherit the
     *     prototype.
     * @param {function} superCtor Constructor function to inherit prototype from.
     */
    inherits: function(ctor, superCtor) {
      var v  = ctor.super_;
      var result = false;
      if (!util.isInheritedFrom(ctor, superCtor)) {
        ctor.super_ = superCtor;
        ctor.__super__ = superCtor.prototype; //for coffeeScirpt super keyword.
        ctor.prototype = util.newPrototype(superCtor, ctor);
        //result = util.inherits(superCtor, v);
        while (v != null) {
          ctor = superCtor;
          superCtor = v;
          ctor.super_ = superCtor;
          ctor.__super__ = superCtor.prototype; //for coffeeScirpt super keyword.
          ctor.prototype = util.newPrototype(superCtor, ctor);
          v = ctor.super_;
        }
        result = true;
      }
      return result;
    },
    isInheritedFrom: function(ctor, superCtor) {
      var result  = ctor.super_ === superCtor;
      var checks = [];
      var lastCtor = ctor;
      checks.push(ctor);
      while (!result && ((ctor = ctor.super_) != null)) {
        if (checks.indexOf(ctor) >= 0) {
          throw Error("Circular inherits found!");
        }
        checks.push(ctor);
        result = ctor.super_ === superCtor;
      }
      return result;
    },
    newPrototype: function(aClass, aConstructor) {
      //Object.create(prototype) only for ES5
      //Object.create(prototype, initProps) only for ES6
      //For Browser:
      //  var Object = function() { this.constructor = aConstructor; };
      //  Object.prototype = aClass.prototype;
      //  return new Object();
      var result = Object.create(aClass.prototype, {
        constructor: {
          value: aConstructor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
      util._extend(result, aConstructor.prototype);
      return result;
    },
    _extend: function(origin, add) {
      // Don't do anything if add isn't an object
      if (!add || !util.isObject(add)) return origin;

      var keys = Object.keys(add);
      var i = keys.length;
      while (i--) {
        origin[keys[i]] = add[keys[i]];
      }
      return origin;
    },
    //make sure the aClass.prototype hook to the aObject instance.
    inheritsObject: function(aObject, aClass) {
      var vOldProto = aObject.__proto__;
      var result = false;
      if ( vOldProto !== aClass.prototype) {
        if (util.inherits(aClass, vOldProto.constructor)) {
          aObject.__proto__ = aClass.prototype;
          result = true;
        }
      }
      return result;
    }
}
