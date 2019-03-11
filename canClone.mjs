/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

'use strict';

const funcToString = Function.prototype.toString;

const nativeCodeRegExp = /^function \w*\(\) \{\s*\[native code\]\s*\}$/m;

export default function canClone(object) {
  if (!object || typeof object !== 'object') {
    return false;
  }

  const proto = Reflect.getPrototypeOf(object);
  if (proto) {
    const ctor = proto.constructor;
    // A Generator object's constructor is an object.
    if (ctor && typeof ctor === 'object') {
      ctor = ctor.constructor;
    }

    if (typeof ctor === 'function' &&
        ctor.name !== 'Array' &&
        ctor.name !== 'Object' &&
        nativeCodeRegExp.test(funcToString.call(ctor))) {
      return false;
    }
  }

  return true;
}
