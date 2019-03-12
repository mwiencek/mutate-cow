/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';
import clone from './clone.mjs';
import {PROXY_CONTEXT} from './constants.mjs';

export function isObject(value) {
  const type = typeof value;
  return value && (type === 'object' || type === 'function');
}

const contextMap = new WeakMap();

export class Context {
  constructor(parent, source, prop, callbacks) {
    this.parent = parent;
    this.source = source;
    this.prop = prop;
    this.copy = null;
    this.callbacks = callbacks;
    this.proxy = null;
    this.childProxy = new Map();
  }

  copyForWrite() {
    if (this.copy) {
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
      ctx.copy = clone(
        ctx.source,
        this.callbacks,
        false,
        null,
      );
      if (ctx.prop) {
        ctx.parent.copy[ctx.prop] = ctx.copy;
      }
    }
  }

  currentTarget() {
    return this.copy || this.source;
  }
}

const handlers = {
  // Since a `set` handler is defined, this should only be called
  // when `defineProperty` is called directly?
  defineProperty: function (fakeTarget, prop, desc) {
    const ctx = contextMap.get(fakeTarget);
    ctx.copyForWrite();
    // Non-configurable properties must exist on the proxy target.
    if (desc.configurable === false && !fakeTarget.hasOwnProperty(prop)) {
      Reflect.defineProperty(fakeTarget, prop, desc);
    }
    return Reflect.defineProperty(ctx.copy, prop, desc);
  },

  deleteProperty: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    ctx.copyForWrite();
    return Reflect.deleteProperty(ctx.copy, prop);
  },

  get: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    const currentTarget = ctx.currentTarget();
    const desc = Reflect.getOwnPropertyDescriptor(currentTarget, prop);
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
      return Reflect.get(currentTarget, prop);
    }

    if (isObject(value)) {
      let p = ctx.childProxy.get(prop);
      if (p) {
        return p;
      }

      p = makeProxy(new Context(
        ctx,
        value,
        prop,
        ctx.callbacks,
      ));

      ctx.childProxy.set(prop, p);
      return p;
    }
    return value;
  },

  getOwnPropertyDescriptor: function (fakeTarget, prop) {
    const ctx = contextMap.get(fakeTarget);
    const desc = Reflect.getOwnPropertyDescriptor(ctx.currentTarget(), prop);
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
    return Reflect.has(ctx.currentTarget(), prop);
  },

  ownKeys: function (fakeTarget) {
    const ctx = contextMap.get(fakeTarget);
    return Reflect.ownKeys(ctx.currentTarget());
  },

  set: function (fakeTarget, prop, value) {
    const ctx = contextMap.get(fakeTarget);
    ctx.copyForWrite();
    if (isObject(value)) {
      const valueCtx = PROXY_CONTEXT.get(value);
      if (valueCtx) {
        value = valueCtx.currentTarget();
      }
    }
    ctx.copy[prop] = value;
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
  const fakeTarget = Array.isArray(source)
    ? []
    : Object.create(Reflect.getPrototypeOf(source));

  const proxy = new Proxy(fakeTarget, handlers);
  PROXY_CONTEXT.set(proxy, ctx);
  ctx.proxy = proxy;
  contextMap.set(fakeTarget, ctx);

  return proxy;
}
