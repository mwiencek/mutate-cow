/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';

function restoreDescriptors(copy, changedDescriptors) {
  for (let [name, origDesc] of Object.entries(changedDescriptors)) {
    const desc = Reflect.getOwnPropertyDescriptor(copy, name);
    if (desc) {
      Object.assign(desc, origDesc);
      Reflect.defineProperty(copy, name, desc);
    }
  }
}

export default function clone(source, callbacks, recursive, seenValues) {
  let changedDescriptors;
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
    let origDesc;
    if (desc.configurable === false) {
      desc.configurable = true;
      origDesc = {configurable: false};
    }
    if (desc.writable === false) {
      desc.writable = true;
      origDesc = origDesc || {};
      origDesc.writable = false;
    }
    if (origDesc) {
      if (!changedDescriptors) {
        changedDescriptors = Object.create(null);
      }
      changedDescriptors[name] = origDesc;
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
  if (changedDescriptors) {
    callbacks.push([restoreDescriptors, copy, changedDescriptors]);
  }
  if (!Reflect.isExtensible(source)) {
    callbacks.push([Reflect.preventExtensions, copy]);
  }
  return copy;
}
