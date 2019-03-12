/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';

export default function clone(source, callbacks, recursive, seenValues) {
  const nonWritableProperties = [];
  let copy;
  if (Array.isArray(source)) {
    copy = new Array(source.length);
  } else {
    if (canClone(source)) {
      copy = Object.create(Reflect.getPrototypeOf(source));
    } else {
      throw new Error('Cloning built-in non-Array or non-Object objects is unsupported.');
    }
  }
  if (recursive) {
    seenValues.add(source);
  }
  for (let name of Object.getOwnPropertyNames(source)) {
    const desc = Reflect.getOwnPropertyDescriptor(source, name);
    if (desc.writable === false) {
      desc.writable = true;
      nonWritableProperties.push(name);
    }
    if (recursive && canClone(desc.value)) {
      // We could return the previously cloned value here, but that
      // isn't how the proxy implementation behaves.
      if (seenValues.has(desc.value)) {
        throw new Error('Unexpected cyclic or shared reference');
      }
      desc.value = clone(desc.value, callbacks, true, seenValues);
    }
    Reflect.defineProperty(copy, name, desc);
  }
  const isExtensible = Reflect.isExtensible(source);
  if (!isExtensible || nonWritableProperties.length) {
    callbacks.push(() => {
      for (let name of nonWritableProperties) {
        const desc = Reflect.getOwnPropertyDescriptor(copy, name);
        desc.writable = false;
        Reflect.defineProperty(copy, name, desc);
      }
      if (!isExtensible) {
        Reflect.preventExtensions(copy);
      }
    });
  }
  return copy;
}
