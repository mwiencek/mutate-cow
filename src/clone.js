/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import {
  NON_CONFIGURABLE,
  NON_CONFIGURABLE_AND_WRITABLE,
  NON_WRITABLE,
} from './constants.js';

function isPrimitive(value) {
  switch (typeof value) {
    case 'bigint':
    case 'boolean':
    case 'number':
    case 'string':
    case 'symbol':
    case 'undefined':
      return true;
    default:
      return value === null;
  }
}

const funcToString = Function.prototype.toString;

const nativeCodeRegExp = /^function \w*\(\) \{\s*\[native code\]\s*\}$/m;

function getCloneableType(value) {
  if (isPrimitive(value)) {
    return 1;
  }
  if (typeof value !== 'object') {
    return 0;
  }
  let proto = Reflect.getPrototypeOf(value);
  while (proto) {
    let ctor = proto.constructor;
    // A Generator object's constructor is an object.
    if (ctor && typeof ctor === 'object') {
      ctor = ctor.constructor;
    }
    if (
      typeof ctor === 'function' &&
      ctor.name !== 'Array' &&
      ctor.name !== 'Object' &&
      nativeCodeRegExp.test(funcToString.call(ctor))
    ) {
      return 0;
    }
    proto = Reflect.getPrototypeOf(proto);
  }
  return 2;
}

export function throwIfNotCloneable(value) {
  throwIfTypeNotCloneable(getCloneableType(value));
}

function throwIfTypeNotCloneable(cloneableType) {
  if (cloneableType === 0) {
    throw new Error(
      'Only plain objects, arrays, and class instances ' +
      'can be cloned. Primitives, functions, and built-ins ' +
      'are unsupported.',
    );
  }
}

function restoreDescriptors(copy, changedDescriptors) {
  for (let i = 0; i < changedDescriptors.length; i++) {
    const [name, origDesc] = changedDescriptors[i];
    const descriptor = Reflect.getOwnPropertyDescriptor(copy, name);
    if (descriptor) {
      Object.assign(descriptor, origDesc);
      Reflect.defineProperty(copy, name, descriptor);
    }
  }
}

export default function clone(source, callbacks) {
  const cloneableType = getCloneableType(source);
  throwIfTypeNotCloneable(cloneableType);
  if (cloneableType === 1) {
    return source;
  }
  const proto = Reflect.getPrototypeOf(source);
  let changedDescriptors;
  let copy;
  if (Array.isArray(source)) {
    copy = Reflect.construct(Array, source, proto.constructor);
  } else {
    copy = Object.create(proto);
  }
  const ownKeys = Reflect.ownKeys(source);
  for (let i = 0; i < ownKeys.length; i++) {
    const key = ownKeys[i];
    const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
    const nonConfigurable = descriptor.configurable === false;
    let origDesc;
    if (nonConfigurable) {
      descriptor.configurable = true;
      origDesc = NON_CONFIGURABLE;
    }
    if (descriptor.writable === false) {
      descriptor.writable = true;
      origDesc = nonConfigurable
        ? NON_CONFIGURABLE_AND_WRITABLE
        : NON_WRITABLE;
    }
    if (origDesc) {
      if (!changedDescriptors) {
        changedDescriptors = [];
      }
      changedDescriptors.push([key, origDesc]);
    }
    Reflect.defineProperty(copy, key, descriptor);
  }
  if (changedDescriptors) {
    callbacks.push({
      func: restoreDescriptors,
      args: [copy, changedDescriptors],
    });
  }
  if (Object.isFrozen(source)) {
    callbacks.push({
      func: Object.freeze,
      args: [copy],
    });
  } else if (Object.isSealed(source)) {
    callbacks.push({
      func: Object.seal,
      args: [copy],
    });
  } else if (!Reflect.isExtensible(source)) {
    callbacks.push({
      func: Reflect.preventExtensions,
      args: [copy],
    });
  }
  return copy;
}
