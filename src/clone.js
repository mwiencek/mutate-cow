/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import throwIfNotCloneable from './throwIfNotCloneable.js';
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
  if (isPrimitive(source)) {
    return source;
  }
  throwIfNotCloneable(source);
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
