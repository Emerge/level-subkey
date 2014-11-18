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
      ctor.super_ = superCtor;
      ctor.__super__ = superCtor.prototype; //for coffeeScirpt super keyword.
      ctor.prototype = util.newPrototype(superCtor, ctor);
      if (v != null) {
        inherits(superCtor, v);
        /*
        if (superCtor.super_ == null) {
          superCtor.super_ = v;
          superCtor.__super__ = v.prototype;
          superCtor.prototype = util.newPrototype(v, superCtor);
        } else {
          throw new Error("superCtor has already super_ exists!");
        } //*/
      }
    },
    newPrototype: function(aClass, aConstructor) {
      //Object.create(prototype) only for ES5
      //Object.create(prototype, initProps) only for ES6
      //For Browser:
      //  var Object = function() { this.constructor = aConstructor; };
      //  Object.prototype = aClass.prototype;
      //  return new Object();
      return Object.create(aClass.prototype, {
        constructor: {
          value: aConstructor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
}
