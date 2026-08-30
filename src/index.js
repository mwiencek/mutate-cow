/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

const EMPTY_OBJECT = Object.freeze({});

const NATIVE_CODE_REGEXP = /^function \w*\(\) \{\s*\[native code\]\s*\}$/m;

const TYPE_PRIMITIVE = 1;
const TYPE_PLAIN_OBJECT = 2;
const TYPE_PLAIN_ARRAY = 3;
const TYPE_UNSUPPORTED = 4;

const STATUS_NONE = 1;
const STATUS_MUTABLE = 2;
const STATUS_REVOKED = 3;
const STATUS_STALE = 4;

function getValueType(value) {
  if (value === null) {
    return TYPE_PRIMITIVE;
  }
  const type = typeof value;
  if (type !== 'object') {
    return type === 'function' ? TYPE_UNSUPPORTED : TYPE_PRIMITIVE;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype) {
    return TYPE_PLAIN_OBJECT;
  } else if (proto === Array.prototype) {
    return Array.isArray(value) ? TYPE_PLAIN_ARRAY : TYPE_UNSUPPORTED;
  } else if (Array.isArray(value)) {
    return (proto !== null && isNativePrototype(proto, 'Array'))
      ? TYPE_PLAIN_ARRAY
      : TYPE_UNSUPPORTED;
  } else if (proto === null) {
    return TYPE_PLAIN_OBJECT;
  }
  return (
    Object.getPrototypeOf(proto) === null &&
    isNativePrototype(proto, 'Object')
  ) ? TYPE_PLAIN_OBJECT : TYPE_UNSUPPORTED;
}

function isNativePrototype(proto, name) {
  const ctor = proto.constructor;
  return (
    typeof ctor === 'function' &&
    ctor.name === name &&
    ctor.prototype === proto &&
    NATIVE_CODE_REGEXP.test(Function.prototype.toString.call(ctor))
  );
}

function setProtoProperty(object, value) {
  Reflect.defineProperty(object, '__proto__', {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export class CowContext {
  constructor(source, prop, parent) {
    this._source = source;
    this._prop = prop;
    this._parent = parent;
    this._result = null;
    this._status = STATUS_NONE;
    this._children = null;
  }

  _copyForWrite(forceObject) {
    if (this._status === STATUS_MUTABLE || this._status === STATUS_REVOKED) {
      return;
    }
    if (!this._result) {
      const source = this._getSource();
      switch (getValueType(source)) {
        case TYPE_PLAIN_OBJECT:
          this._result = {...source};
          break;
        case TYPE_PLAIN_ARRAY:
          this._result = source.slice();
          break;
        case TYPE_PRIMITIVE:
          this._result = forceObject ? {} : source;
          break;
        default:
          throw new Error('Only plain objects and arrays can be cloned.');
      }
    }
    const parent = this._parent;
    if (parent) {
      parent._copyForWrite(/* forceObject = */ true);
      const prop = this._prop;
      if (prop === '__proto__') {
        setProtoProperty(parent._result, this._result);
      } else {
        parent._result[prop] = this._result;
      }
    }
    this._status = STATUS_MUTABLE;
  }

  _getPropValue(prop) {
    return Reflect.get(this._read() ?? EMPTY_OBJECT, prop);
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
    this._copyForWrite(/* forceObject = */ false);
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

    child = new this.constructor(value, prop, this);
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
      this._result = null;
      // Child source values must be invalidated, because they can
      // reference a previous copy we made.
      this._setAllChildrenAsStale();
    }
  }

  _set(prop, newValue) {
    this._copyForWrite(/* forceObject = */ true);
    if (prop === '__proto__') {
      setProtoProperty(this._result, newValue);
    } else {
      this._result[prop] = newValue;
    }

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
    const object = this._read() ?? EMPTY_OBJECT;
    if (
      !Object.hasOwn(object, prop) ||
      !Object.is(Reflect.get(object, prop), newValue)
    ) {
      this._set(prop, newValue);
    }
  }

  _setStale() {
    this._source = null;
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

  _getForMerge(prop) {
    const child = this._get(prop);
    if (!Object.hasOwn(this._read() ?? EMPTY_OBJECT, prop)) {
      child._source = null;
      child._status = STATUS_NONE;
      child._setAllChildrenAsStale();
    }
    return child;
  }

  _merge(object) {
    if (Array.isArray(this._read())) {
      throw new Error('`merge` cannot be used to patch an array.');
    }
    const keys = Reflect.ownKeys(object);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!Object.getOwnPropertyDescriptor(object, key).enumerable) {
        continue;
      }
      const newValue = Reflect.get(object, key);
      if (getValueType(newValue) === TYPE_PLAIN_OBJECT) {
        this._getForMerge(key)._merge(newValue);
      } else {
        this._setIfChanged(key, newValue);
      }
    }
  }

  merge(object) {
    this._throwIfRevoked();
    if (getValueType(object) !== TYPE_PLAIN_OBJECT) {
      throw new Error('`merge` must be called with a plain object.');
    }
    this._merge(object);
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

  _revoke(recursive) {
    if (this.isRevoked()) {
      return;
    }
    if (this._parent) {
      this._parent._children.delete(this._prop);
    }
    if (recursive && this._children) {
      const childrenToRevoke = [...this._children.values()];
      for (const child of childrenToRevoke) {
        child._revoke(true);
      }
    }
    this._children = null;
    this._source = null;
    this._prop = null;
    this._parent = null;
    this._result = null;
    this._status = STATUS_REVOKED;
  }

  revoke() {
    this._revoke(/* recursive = */ true);
  }

  isRevoked() {
    return this._status === STATUS_REVOKED;
  }

  final() {
    this._throwIfRevoked();
    if (this._children) {
      const childrenToFinalize = [...this._children.values()];
      for (const child of childrenToFinalize) {
        child.final();
      }
    }
    const result = this._read();
    this._revoke(/* recursive = */ false);
    return result;
  }

  finalRoot() {
    return this.root().final();
  }
}

export default function mutate(source) {
  return new CowContext(source, null, null);
}
