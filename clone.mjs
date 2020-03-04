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
  for (let i = 0; i < changedDescriptors.length; i++) {
    const [name, origDesc] = changedDescriptors[i];
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
    copy = Object.create(Reflect.getPrototypeOf(source));
  }
  if (recursive) {
    seenValues.push(source);
  }
  const ownNames = Object.getOwnPropertyNames(source);
  for (let i = 0; i < ownNames.length; i++) {
    const name = ownNames[i];
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
      if (seenValues.indexOf(desc.value) >= 0) {
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
