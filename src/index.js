/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

const NATIVE_CODE_REGEXP = /^function \w*\(\) \{\s*\[native code\]\s*\}$/m;

const STATUS_NONE = 1;
const STATUS_MUTABLE = 2;
const STATUS_REVOKED = 3;
const STATUS_STALE = 4;

function isPrimitive(value) {
  if (value === null) {
    return true;
  }
  const type = typeof value;
  return (type !== 'function' && type !== 'object');
}

function isCloneableObject(object) {
  if (typeof object === 'function') {
    return false;
  }
  let proto = Object.getPrototypeOf(object);
  while (proto) {
    let ctor = proto.constructor;
    if (!ctor) {
      continue;
    }
    // A Generator object's constructor is an object.
    if (typeof ctor === 'object') {
      ctor = ctor.constructor;
    }
    if (
      typeof ctor === 'function' &&
      ctor.name !== 'Array' &&
      ctor.name !== 'Object' &&
      NATIVE_CODE_REGEXP.test(Function.prototype.toString.call(ctor))
    ) {
      return false;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return true;
}

function printConstructor(object) {
  const ctor = object.constructor;
  switch (typeof ctor) {
    case 'function':
      return ctor.name;
    case 'object':
      return Object.prototype.toString.call(ctor);
    default:
      return '';
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

function clone(context) {
  const source = context._getSource();
  if (isPrimitive(source)) {
    return source;
  }
  if (!isCloneableObject(source)) {
    throw new Error(
      printConstructor(source) +
      ' objects are not supported for cloning.',
    );
  }
  if (context._strict) {
    return cloneObjectStrict(source, context);
  }
  return cloneObjectLoose(source);
}

function cloneObjectLoose(source) {
  if (Array.isArray(source)) {
    return source.slice();
  }
  return {...source};
}

function cloneObjectStrict(source, context) {
  if (!context._callbacks) {
    context._callbacks = [];
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
    let origDesc;
    if (descriptor.configurable === false) {
      descriptor.configurable = true;
      origDesc = {configurable: false};
    }
    if (descriptor.writable === false) {
      descriptor.writable = true;
      origDesc = {...origDesc, writable: false};
    }
    if (origDesc) {
      changedDescriptors.push([key, origDesc]);
    }
    Reflect.defineProperty(copy, key, descriptor);
  }
  if (changedDescriptors.length) {
    context._callbacks.push({
      func: restoreDescriptors,
      args: [copy, changedDescriptors],
    });
  }
  if (Object.isFrozen(source)) {
    context._callbacks.push({
      func: Object.freeze,
      args: [copy],
    });
  } else if (Object.isSealed(source)) {
    context._callbacks.push({
      func: Object.seal,
      args: [copy],
    });
  } else if (!Object.isExtensible(source)) {
    context._callbacks.push({
      func: Object.preventExtensions,
      args: [copy],
    });
  }
  return copy;
}

export class CowContext {
  constructor(source, prop, parent, strict = false) {
    this._source = source;
    this._prop = prop;
    this._parent = parent;
    this._callbacks = null;
    this._result = null;
    this._status = STATUS_NONE;
    this._children = null;
    this._strict = strict;
  }

  _copyForWrite() {
    const status = this._status;
    if (
      status === STATUS_MUTABLE ||
      status === STATUS_REVOKED
    ) {
      return;
    }
    const stack = [];
    let parent = this;
    while (parent && parent._status !== STATUS_MUTABLE) {
      stack.push(parent);
      parent = parent._parent;
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      const context = stack[i];
      if (!context._result) {
        context._result = clone(context);
      }
      if (context._parent) {
        context._parent._result[context._prop] = context._result;
      }
      context._status = STATUS_MUTABLE;
    }
  }

  _getPropValue(prop) {
    return Reflect.get(this._read(), prop);
  }

  _getSource() {
    if (this._status === STATUS_STALE) {
      /*
       * `this._parent` should always be defined here, because we only
       * ever set `STATUS_STALE` onto child contexts.
       */
      this._source = this._parent._getPropValue(this._prop);
      this._status = STATUS_NONE;
    }
    return this._source;
  }

  _throwIfRevoked() {
    if (this.isRevoked()) {
      throw new Error(
        'This context has been revoked and can no longer be used.',
      );
    }
  }

  _read() {
    return this._status === STATUS_MUTABLE ? this._result : this._getSource();
  }

  read() {
    this._throwIfRevoked();
    return this._read();
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

    child = new CowContext(value, prop, this, this._strict);
    children.set(prop, child);
    return child;
  }

  get(...props) {
    this._throwIfRevoked();
    let ctx = this;
    for (const prop of props) {
      ctx = ctx._get(prop);
    }
    return ctx;
  }

  _replace(value) {
    const parent = this._parent;
    if (parent) {
      parent._setIfChanged(this._prop, value);
    } else {
      this._source = value;
      this._status = STATUS_NONE;
      this._callbacks = null;
      this._result = null;
      // Child source values must be invalidated, because they can
      // reference a previous copy we made.
      this._setAllChildrenAsStale();
    }
  }

  _set(prop, newValue) {
    this._copyForWrite();
    this._result[prop] = newValue;

    // Child source values must be invalidated, because they can
    // reference a previous copy we made.
    const children = this._children;
    if (children) {
      const child = children.get(prop);
      if (child) {
        child._setStale();
      }
    }
  }

  _setIfChanged(prop, newValue) {
    if (
      !Object.hasOwn(this._read(), prop) ||
      !Object.is(this._getPropValue(prop), newValue)
    ) {
      this._set(prop, newValue);
    }
  }

  _setStale() {
    this._source = null;
    this._callbacks = null;
    this._result = null;
    this._status = STATUS_STALE;
    this._setAllChildrenAsStale();
  }

  _setAllChildrenAsStale() {
    const children = this._children;
    if (children) {
      for (const child of children.values()) {
        child._setStale();
      }
    }
  }

  set(...args) {
    const newValue = args.pop();
    const hasProps = args.length > 0;
    if (hasProps) {
      const lastProp = args.pop();
      this.get(...args)._setIfChanged(lastProp, newValue);
    } else {
      this._throwIfRevoked();
      this._replace(newValue);
    }
    return this;
  }

  update(...args) {
    const updater = args.pop();
    updater(this.get(...args));
    return this;
  }

  dangerouslySetAsMutable() {
    this._throwIfRevoked();
    const source = this._getSource();
    // N.B. This may be (dangerously) equal to `source`.
    const mutableValue = this._read();
    const parent = this._parent;
    if (parent) {
      parent._set(this._prop, mutableValue);
    }
    this._source = source;
    this._result = mutableValue;
    this._status = STATUS_MUTABLE;
    this._callbacks = null;
    this._setAllChildrenAsStale();
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
    const result = this._read();
    const callbacks = this._callbacks;
    this.revoke();
    if (callbacks) {
      for (let i = 0; i < callbacks.length; i++) {
        const {func, args} = callbacks[i];
        func(...args);
      }
    }
    return result;
  }

  finalRoot() {
    return this.root().final();
  }
}

export default function mutate(source, strict = false) {
  return new CowContext(source, null, null, strict);
}
