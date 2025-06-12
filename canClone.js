/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

const funcToString = Function.prototype.toString;

const nativeCodeRegExp = /^function \w*\(\) \{\s*\[native code\]\s*\}$/m;

export const CANNOT_CLONE_ERROR =
  'Only plain objects, arrays, and class instances ' +
  'can be cloned. Primitives, functions, and built-ins ' +
  'are unsupported.';

export default function canClone(object) {
  if (!object || typeof object !== 'object') {
    throw new Error(CANNOT_CLONE_ERROR);
  }

  let proto = Reflect.getPrototypeOf(object);

  while (proto) {
    let ctor = proto.constructor;
    // A Generator object's constructor is an object.
    if (ctor && typeof ctor === 'object') {
      ctor = ctor.constructor;
    }

    if (typeof ctor === 'function' &&
        ctor.name !== 'Array' &&
        ctor.name !== 'Object' &&
        nativeCodeRegExp.test(funcToString.call(ctor))) {
      throw new Error(CANNOT_CLONE_ERROR);
    }

    proto = Reflect.getPrototypeOf(proto);
  }
}
