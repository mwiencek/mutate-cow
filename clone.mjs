/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';

import {
  NON_CONFIGURABLE,
  NON_CONFIGURABLE_AND_WRITABLE,
  NON_WRITABLE,
} from './constants.mjs';

function restoreDescriptors(copy, changedDescriptors) {
  for (const [name, origDesc] of changedDescriptors) {
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
    const nonConfigurable = desc.configurable === false;
    let origDesc;
    if (nonConfigurable) {
      desc.configurable = true;
      origDesc = NON_CONFIGURABLE;
    }
    if (desc.writable === false) {
      desc.writable = true;
      origDesc = nonConfigurable
        ? NON_CONFIGURABLE_AND_WRITABLE
        : NON_WRITABLE;
    }
    if (origDesc) {
      if (!changedDescriptors) {
        changedDescriptors = [];
      }
      changedDescriptors.push([name, origDesc]);
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
