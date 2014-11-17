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
      return typeof arg === 'object' && arg !== null;
    },

    isFunction: function(arg) {
      return typeof arg === 'function';
    },

    isDate: function(d) {
      return util.isObject(d) && util.objectToString(d) === '[object Date]';
    }
}
