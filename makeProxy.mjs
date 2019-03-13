/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';
import clone from './clone.mjs';
import {PROXY_CONTEXT} from './constants.mjs';
import isObject from './isObject.mjs';
import unwrap from './unwrap.mjs';

const contextMap = new WeakMap();

export class Context {
  constructor(root, parent, source, prop) {
    this.root = root;
    this.parent = parent;
    this.source = source;
    this.prop = prop;
    this.copy = null;
    this.callbacks = null;
    this.proxy = null;
    this.childProxy = new Map();
    this.currentTarget = source;
    this.isRevoked = false;
  }

  copyForWrite() {
    if (this.copy || this.isRevoked || this.root.isRevoked) {
      return;
    }
    const stack = [];
    let parent = this;
    while (parent && !parent.copy) {
      stack.push(parent);
      parent = parent.parent;
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      let ctx = stack[i];
      ctx.copy = ctx.currentTarget = clone(
        ctx.source,
        ctx.root.callbacks,
        false,
        null,
      );
      if (ctx.prop) {
        ctx.parent.copy[ctx.prop] = ctx.copy;
      }
    }
  }

  revoke() {
    if (this.isRevoked) {
      return;
    }
    this.root = null;
    this.parent = null;
    this.source = null;
    this.prop = null;
    this.copy = null;
    this.callbacks = null;
    this.proxy = null;
    this.childProxy = null
    this.currentTarget = null;
    this.isRevoked = true;
  }

  throwIfRevoked() {
    if (this.root.isRevoked) {
      this.revoke();
      throw new Error(
        'This Proxy can no longer be accessed. ' +
        'You may have forgotten to call unwrap() on an assigned value.',
      );
    }
  }
}

const handlers = {
  apply: function (fakeTarget, thisArg, argumentsList) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    return Reflect.apply(ctx.source, thisArg, argumentsList);
  },

  // Since a `set` handler is defined, this should only be called
  // when `defineProperty` is called directly?
  defineProperty: function (fakeTarget, prop, desc) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    ctx.copyForWrite();
    // Non-configurable properties must exist on the proxy target.
    if (desc.configurable === false && !fakeTarget.hasOwnProperty(prop)) {
      Reflect.defineProperty(fakeTarget, prop, desc);
    }
    return Reflect.defineProperty(ctx.copy, prop, desc);
  },

  deleteProperty: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    ctx.copyForWrite();
    return Reflect.deleteProperty(ctx.copy, prop);
  },

  get: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    const desc = Reflect.getOwnPropertyDescriptor(ctx.currentTarget, prop);
    let value;

    if (desc) {
      if (desc.get) {
        return desc.get.call(ctx.proxy, prop);
      }
      value = desc.value;
    } else {
      if (!canClone(ctx.source)) {
        throw new Error(
          'Accessing properties and methods through built-in ' +
          'non-Array or non-Object objects is unsupported. ' +
          'If you know what you\'re doing, access them through ' +
          'the original object instead.',
        );
      }
      return Reflect.get(ctx.currentTarget, prop);
    }

    if (isObject(value)) {
      let p = ctx.childProxy.get(prop);
      if (p) {
        return p;
      }

      p = makeProxy(new Context(
        ctx.root,
        ctx,
        value,
        prop,
      ));

      ctx.childProxy.set(prop, p);
      return p;
    }
    return value;
  },

  getOwnPropertyDescriptor: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    const desc = Reflect.getOwnPropertyDescriptor(ctx.currentTarget, prop);
    if (desc && (!Array.isArray(ctx.source) || prop !== 'length')) {
      desc.configurable = true;
      if (!desc.get && !desc.set) {
        desc.writable = true;
      }
    }
    return desc;
  },

  has: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    return Reflect.has(ctx.currentTarget, prop);
  },

  ownKeys: function (fakeTarget) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    return Reflect.ownKeys(ctx.currentTarget);
  },

  set: function (fakeTarget, prop, value) {
    const ctx = contextMap.get(fakeTarget);
    ctx.throwIfRevoked();
    ctx.copyForWrite();
    ctx.copy[prop] = unwrap(value);
    // This must be deleted, because it can now refer to an outdated
    // value (i.e. a previous copy we made).
    ctx.childProxy.delete(prop);
    return true;
  },
};

export default function makeProxy(ctx) {
  const source = ctx.source;

  // Using a fake proxy target avoids having to deal with proxy
  // invariants. See section 9.5.8 of
  // https://www.ecma-international.org/ecma-262/8.0/
  const fakeTarget = typeof source === 'function'
    ? (() => undefined)
    : (Array.isArray(source)
        ? []
        : Object.create(Reflect.getPrototypeOf(source)));

  const proxy = new Proxy(fakeTarget, handlers);
  PROXY_CONTEXT.set(proxy, ctx);
  ctx.proxy = proxy;
  contextMap.set(fakeTarget, ctx);

  return proxy;
}
