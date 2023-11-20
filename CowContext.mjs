/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import clone from './clone.mjs';
import {
  STATUS_CHANGED,
  STATUS_NONE,
  STATUS_REVOKED,
} from './constants.mjs';

const STALE_VALUE = Object.freeze(Object.create(null));

export default class CowContext {
  constructor(source, prop, root, parent) {
    this._source = source;
    this._prop = prop;
    this._root = root || this;
    this._parent = parent;
    this._callbacks = [];
    this._result = null;
    this._status = STATUS_NONE;
    this._children = null;
  }

  _copyForWrite() {
    const status = this._status;
    if (
      status === STATUS_CHANGED ||
      status === STATUS_REVOKED
    ) {
      return;
    }
    const stack = [];
    let parent = this;
    while (parent && parent._status !== STATUS_CHANGED) {
      stack.push(parent);
      parent = parent._parent;
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      const context = stack[i];
      if (!context._result) {
        context._result = clone(context._getSource(), context._callbacks);
      }
      if (context._parent) {
        context._parent._result[context._prop] = context._result;
      }
      context._status = STATUS_CHANGED;
    }
  }

  _getPropValue(prop) {
    const target = this.read();
    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
    if (descriptor) {
      if (descriptor.get) {
        throw new Error('Getters are unsupported.');
      }
      if (descriptor.set) {
        throw new Error('Setters are unsupported.');
      }
      return descriptor.value;
    }
    return Reflect.get(target, prop);
  }

  _getSource() {
    let source = this._source;
    if (source === STALE_VALUE) {
      /*
       * `this._parent` should always be defined here, because we only
       * ever assign `STALE_VALUE` onto child contexts.
       */
      source = this._parent._getPropValue(this._prop);
      this._source = source;
    }
    return source;
  }

  _throwIfRevoked() {
    if (this.isRevoked()) {
      throw new Error(
        'This context has been revoked and can no longer be used.',
      );
    }
  }

  read() {
    this._throwIfRevoked();
    return this._status === STATUS_CHANGED ? this._result : this._getSource();
  }

  write() {
    this._throwIfRevoked();
    this._copyForWrite();
    return this._result;
  }

  _get(prop) {
    const value = this._getPropValue(prop);

    let children = this._children;
    if (!children) {
      children = new Map();
      this._children = children;
    }

    let child = children.get(prop);
    if (child) {
      return child;
    }

    child = new CowContext(value, prop, this._root, this);
    children.set(prop, child);
    return child;
  }

  get(...props) {
    let ctx = this;
    for (const prop of props) {
      ctx = ctx._get(prop);
    }
    return ctx;
  }

  _replace(value) {
    const parent = this._parent;
    if (parent) {
      parent.set(this._prop, value);
    } else {
      this._source = value;
    }
  }

  _set(prop, newValue) {
    const origValue = this._getPropValue(prop);

    if (!Object.is(origValue, newValue)) {
      this._copyForWrite();
      this._result[prop] = newValue;

      // Child source values must be invalidated, because they can
      // reference a previous copy we made.
      const children = this._children;
      if (children) {
        const child = children.get(prop);
        if (child) {
          child._source = STALE_VALUE;
          child._callbacks = [];
          child._result = null;
          child._status = STATUS_NONE;
        }
      }
    }

    return this;
  }

  set(...args) {
    this._throwIfRevoked();
    const newValue = args.pop();
    const hasProps = args.length > 0;
    const lastProp = hasProps ? args.pop() : undefined;
    const ctx = hasProps ? this.get(...args) : this;
    if (hasProps) {
      ctx._set(lastProp, newValue);
    } else {
      ctx._replace(newValue);
    }
    return this;
  }

  update(...args) {
    const updater = args.pop();
    updater(this.get(...args));
    return this;
  }

  parent() {
    this._throwIfRevoked();
    return this._parent;
  }

  root() {
    this._throwIfRevoked();
    return this._root;
  }

  revoke() {
    if (this.isRevoked()) {
      return;
    }
    if (this._parent) {
      this._parent._children.delete(this._prop);
    }
    if (this._children) {
      for (const child of this._children.values()) {
        child.revoke();
      }
      this._children = null;
    }
    this._source = null;
    this._prop = null;
    this._root = null;
    this._parent = null;
    this._callbacks = null;
    this._result = null;
    this._status = STATUS_REVOKED;
  }

  isRevoked() {
    return this._status === STATUS_REVOKED;
  }

  final() {
    this._throwIfRevoked();
    if (this._children) {
      for (const child of this._children.values()) {
        child.final();
      }
    }
    const result = this.read();
    const callbacks = this._callbacks;
    this.revoke();
    for (let i = 0; i < callbacks.length; i++) {
      const {func, args} = callbacks[i];
      func(...args);
    }
    return result;
  }

  finalRoot() {
    return this.root().final();
  }
}
