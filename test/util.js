var tape = require('tape')

var util = require('../util')

var Root = function(){};
Root.prototype.className = "Root";
Root.prototype.rootMethod = function(){};

var B = function(){};
B.prototype.className = "B";
B.prototype.bMethod = function(){};

var A = function(){};
function aMethod(){console.log("aMethod");}
A.prototype.aMethod = aMethod;
A.prototype.className = 'A';

var A1 = function(){};
function a1Method(){console.log("a1Method");}
A1.prototype.a1Method = a1Method;
A1.prototype.className = 'A1';

tape('inherits and isInheritedFrom', function (t) {
  t.equal(util.inherits(A, Root), true);
  t.equal(util.inherits(A, Root), false);

  t.equal(util.inherits(B, Root), true);

  t.equal(util.inherits(A1, A), true);
  t.equal(A1.super_, A);
  t.equal(A1.prototype.a1Method, a1Method);
  t.equal(A.prototype.aMethod, aMethod);
  t.equal(A1.prototype.constructor, A1);
  t.equal(util.inherits(A1, Root), false, "A1 can not inherit Root again");
  t.equal(A1.super_, A);
  t.equal(A.super_, Root);
  t.equal(Root.super_, undefined);
  t.equal(util.isInheritedFrom(A1, Root), true);
  t.equal(util.isInheritedFrom(A1, A), true);
  t.equal(util.isInheritedFrom(A1, B), false, "A1 is not inherited from B");
  t.end();

});

tape('inheritsObject', function (t) {
  var C = function(){};
  C.prototype.className = "C";
  function cMethod(){console.log("cMethod");}
  C.prototype.cMethod = cMethod;

  var b = new B();
  t.equal(util.inheritsObject(b, C), true);
  var bProto = b.__proto__;
  t.equal(bProto.cMethod, cMethod);
  t.equal(bProto.constructor, C);
  t.equal(C.super_, B);
  var b1 = new B();
  t.equal(util.inheritsObject(b1, C), true);
  bProto = b1.__proto__;
  t.equal(bProto.cMethod, cMethod);
  t.equal(bProto.constructor, C);
  t.equal(bProto, C.prototype);
  t.end();
});


