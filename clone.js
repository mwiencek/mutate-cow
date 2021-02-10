/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

const NON_CONFIGURABLE = Object.freeze(Object.create(null, {
  configurable: {
    enumerable: true,
    value: false,
  },
}));

const NON_WRITABLE = Object.freeze(Object.create(null, {
  writable: {
    enumerable: true,
    value: false,
  },
}));

const NON_CONFIGURABLE_AND_WRITABLE = Object.freeze(Object.create(null, {
  configurable: {
    enumerable: true,
    value: false,
  },
  writable: {
    enumerable: true,
    value: false,
  },
}));

function restoreDescriptors(copy, changedDescriptors) {
  for (let i = 0; i < changedDescriptors.length; i++) {
    const [name, origDesc] = changedDescriptors[i];
    const desc = Object.getOwnPropertyDescriptor(copy, name);
    if (desc) {
      Object.assign(desc, origDesc);
      Object.defineProperty(copy, name, desc);
    }
  }
}

export default function clone(ctx) {
  const source = ctx.source;
  let changedDescriptors;
  let copy;
  const isArray = Array.isArray(source);
  if (isArray) {
    copy = new Array(source.length);
  } else {
    copy = Object.create(Object.getPrototypeOf(source));
  }
  const ownNames = Object.getOwnPropertyNames(source);
  for (let i = 0; i < ownNames.length; i++) {
    const name = ownNames[i];
    if (isArray && name === 'length') {
      continue;
    }
    const desc = Object.getOwnPropertyDescriptor(source, name);
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
    Object.defineProperty(copy, name, desc);
  }
  if (changedDescriptors) {
    if (ctx.callbacks == null) {
      ctx.callbacks = [];
    }
    ctx.callbacks.push([restoreDescriptors, copy, changedDescriptors]);
  }
  if (!Object.isExtensible(source)) {
    if (ctx.callbacks == null) {
      ctx.callbacks = [];
    }
    ctx.callbacks.push([Object.preventExtensions, copy]);
  }
  ctx.result = copy;
}
