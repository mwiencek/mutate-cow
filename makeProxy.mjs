/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';
import clone from './clone.mjs';
import {
  CANNOT_CLONE_ERROR,
  CONFIGURABLE_AND_WRITABLE,
  PROXY_UNWRAP_KEY,
  STATUS_CHANGED,
  STATUS_NONE,
  STATUS_REVOKED,
} from './constants.mjs';
import isObject from './isObject.mjs';
import unwrap from './unwrap.mjs';

export function Context(root, parent, prop) {
  this.root = root || this;
  this.parent = parent;
  this.prop = prop;
  this.copy = null;
  this.status = STATUS_NONE;
}

Context.prototype.copyForWrite = function () {
  const status = this.status;
  if (status === STATUS_CHANGED ||
      status === STATUS_REVOKED ||
      this.root.status === STATUS_REVOKED) {
    return;
  }
  const stack = [];
  let parent = this;
  while (parent && parent.status !== STATUS_CHANGED) {
    stack.push(parent);
    parent = parent.parent;
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const ctx = stack[i];
    if (!ctx.copy) {
      throw new Error(CANNOT_CLONE_ERROR);
    }
    if (ctx.prop) {
      ctx.parent.copy[ctx.prop] = ctx.copy;
    }
    ctx.status = STATUS_CHANGED;
  }
};

Context.prototype.revoke = function () {
  if (this.status === STATUS_REVOKED) {
    return;
  }
  this.root = null;
  this.parent = null;
  this.prop = null;
  this.copy = null;
  this.status = STATUS_REVOKED;
};

Context.prototype.throwIfRevoked = function () {
  let revoked = this.status === STATUS_REVOKED;
  if (!revoked && this.root && this.root.status === STATUS_REVOKED) {
    this.revoke();
    revoked = true;
  }
  if (revoked) {
    throw new Error(
      'This Proxy can no longer be accessed. ' +
      'You may have forgotten to call unwrap() on an assigned value.',
    );
  }
};

export default function makeProxy(ctx, source, callbacks) {
  ctx.copy = canClone(source)
    ? clone(source, callbacks)
    : null;

  const childProxies = Object.create(null);

  const proxy = new Proxy(ctx.copy || source, {
    construct: function (target, args) {
      ctx.throwIfRevoked();
      return new source(...args);
    },

    // Since a `set` handler is defined, this should only be called
    // when `defineProperty` is called directly?
    defineProperty: function (target, prop, desc) {
      ctx.throwIfRevoked();
      ctx.copyForWrite();
      return Reflect.defineProperty(ctx.copy, prop, desc);
    },

    deleteProperty: function (target, prop) {
      ctx.throwIfRevoked();
      ctx.copyForWrite();
      return Reflect.deleteProperty(ctx.copy, prop);
    },

    get: function (target, prop) {
      if (prop === PROXY_UNWRAP_KEY) {
        return ctx.status === STATUS_CHANGED ? ctx.copy : source;
      }

      ctx.throwIfRevoked();
      const desc = Reflect.getOwnPropertyDescriptor(target, prop);
      let value;

      if (desc) {
        if (desc.get) {
          return desc.get.call(proxy, prop);
        }
        value = desc.value;
      } else {
        if (!canClone(source)) {
          throw new Error(
            'Accessing properties and methods through built-in ' +
            'non-Array or non-Object objects is unsupported. ' +
            'If you know what you\'re doing, access them through ' +
            'the original object instead.',
          );
        }
        return Reflect.get(target, prop);
      }

      if (isObject(value)) {
        return childProxies[prop] || (
          childProxies[prop] = makeProxy(new Context(
            ctx.root,
            ctx,
            prop,
          ), value, callbacks)
        );
      }
      return value;
    },

    preventExtensions: function (target) {
      ctx.throwIfRevoked();
      ctx.copyForWrite();
      Reflect.preventExtensions(ctx.copy);
      return true;
    },

    set: function (target, prop, value) {
      ctx.throwIfRevoked();

      const origValue = Reflect.get(target, prop);
      const newValue = unwrap(value);

      if (!Object.is(origValue, newValue)) {
        ctx.copyForWrite();
        ctx.copy[prop] = newValue;
        // This must be deleted, because it can now refer to an outdated
        // value (i.e. a previous copy we made).
        delete childProxies[prop];
      }

      return true;
    },
  });

  return proxy;
}
