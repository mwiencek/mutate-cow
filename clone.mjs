/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

'use strict';

export default function clone(source, callbacks) {
  const nonWritableProperties = [];
  let copy;
  if (Array.isArray(source)) {
    copy = new Array(source.length);
  } else {
    if (typeof source === 'function') {
      // No one should ever be doing this
      throw new Error('Cloning functions is unsupported');
    }
    copy = Object.create(Object.getPrototypeOf(source));
  }
  for (let name of Object.getOwnPropertyNames(source)) {
    const desc = Object.getOwnPropertyDescriptor(source, name);
    if (desc.writable === false) {
      desc.writable = true;
      nonWritableProperties.push(name);
    }
    Object.defineProperty(copy, name, desc);
  }
  const isExtensible = Object.isExtensible(source);
  if (!isExtensible || nonWritableProperties.length) {
    callbacks.push(() => {
      for (let name of nonWritableProperties) {
        const desc = Object.getOwnPropertyDescriptor(copy, name);
        desc.writable = false;
        Object.defineProperty(copy, name, desc);
      }
      if (!isExtensible) {
        Object.preventExtensions(copy);
      }
    });
  }
  return copy;
}
