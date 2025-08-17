/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

const NON_CONFIGURABLE = Object.freeze({configurable: false});

const NON_WRITABLE = Object.freeze({writable: false});

const NON_CONFIGURABLE_AND_WRITABLE = Object.freeze({
  configurable: false,
  writable: false,
});

function isPrimitive(value) {
  if (value === null) {
    return true;
  }
  const type = typeof value;
  return (type !== 'function' && type !== 'object');
}

const funcToString = Function.prototype.toString;

const nativeCodeRegExp = /^function \w*\(\) \{\s*\[native code\]\s*\}$/m;

function getCloneableType(value) {
  if (isPrimitive(value)) {
    return 1;
  }
  if (typeof value !== 'object') {
    return 0;
  }
  let proto = Object.getPrototypeOf(value);
  while (proto) {
    let ctor = proto.constructor;
    // A Generator object's constructor is an object.
    if (ctor && typeof ctor === 'object') {
      ctor = ctor.constructor;
    }
    if (
      typeof ctor === 'function' &&
      ctor.name !== 'Array' &&
      ctor.name !== 'Object' &&
      nativeCodeRegExp.test(funcToString.call(ctor))
    ) {
      return 0;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return 2;
}

function throwIfNotCloneable(value) {
  throwIfTypeNotCloneable(getCloneableType(value));
}

function throwIfTypeNotCloneable(cloneableType) {
  if (cloneableType === 0) {
    throw new Error(
      'Only plain objects, arrays, and class instances ' +
      'can be cloned. Primitives, functions, and built-ins ' +
      'are unsupported.',
    );
  }
}

function restoreDescriptors(copy, changedDescriptors) {
  for (let i = 0; i < changedDescriptors.length; i++) {
    const [name, origDesc] = changedDescriptors[i];
    const descriptor = Object.getOwnPropertyDescriptor(copy, name);
    if (descriptor) {
      Object.assign(descriptor, origDesc);
      Reflect.defineProperty(copy, name, descriptor);
    }
  }
}

function clone(source, callbacks) {
  const cloneableType = getCloneableType(source);
  throwIfTypeNotCloneable(cloneableType);
  if (cloneableType === 1) {
    return source;
  }
  const proto = Object.getPrototypeOf(source);
  let changedDescriptors = [];
  let copy;
  if (Array.isArray(source)) {
    copy = Reflect.construct(Array, source, proto.constructor);
  } else {
    copy = Object.create(proto);
  }
  const ownKeys = Reflect.ownKeys(source);
  for (let i = 0; i < ownKeys.length; i++) {
    const key = ownKeys[i];
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    const nonConfigurable = descriptor.configurable === false;
    let origDesc;
    if (nonConfigurable) {
      descriptor.configurable = true;
      origDesc = NON_CONFIGURABLE;
    }
    if (descriptor.writable === false) {
      descriptor.writable = true;
      origDesc = nonConfigurable
        ? NON_CONFIGURABLE_AND_WRITABLE
        : NON_WRITABLE;
    }
    if (origDesc) {
      changedDescriptors.push([key, origDesc]);
    }
    Reflect.defineProperty(copy, key, descriptor);
  }
  if (changedDescriptors.length) {
    callbacks.push({
      func: restoreDescriptors,
      args: [copy, changedDescriptors],
    });
  }
  if (Object.isFrozen(source)) {
    callbacks.push({
      func: Object.freeze,
      args: [copy],
    });
  } else if (Object.isSealed(source)) {
    callbacks.push({
      func: Object.seal,
      args: [copy],
    });
  } else if (!Object.isExtensible(source)) {
    callbacks.push({
      func: Object.preventExtensions,
      args: [copy],
    });
  }
  return copy;
}

const STATUS_NONE = 1;
const STATUS_CHANGED = 2;
const STATUS_REVOKED = 3;

const STALE_VALUE = Object.freeze(Object.create(null));

export class CowContext {
  constructor(source, prop, parent) {
    this._source = source;
    this._prop = prop;
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

    child = new CowContext(value, prop, this);
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
    let root = this;
    while (root._parent !== null) {
      root = root._parent;
    }
    return root;
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

export default function mutate(source) {
  throwIfNotCloneable(source);
  return new CowContext(source, null, null);
}
