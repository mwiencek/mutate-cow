/*
 * Copyright (c) 2019-2021 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone';
import clone from './clone';
import isObject from './isObject';
import isPrimitive from './isPrimitive';

function MutationContext(
  source,
  parent,
  prop,
) {
  this.source = source;
  this.parent = parent;
  this.prop = prop;
  this.result = source;
  this.children = null;
  this.callbacks = null;
  this.finalized = false;
}

MutationContext.prototype._copyResultToParent = function () {
  const parent = this.parent;
  if (parent) {
    parent._copyForWrite();
    parent.result[this.prop] = this.result;
  }
};

MutationContext.prototype._copyForWrite = function () {
  if (Object.is(this.result, this.source)) {
    if (isPrimitive(this.source)) {
      // no-op
    } else if (canClone(this.source)) {
      clone(this);
    } else {
      throw new Error('Only simple arrays and objects can be cloned.');
    }
    this._copyResultToParent();
  }
};

MutationContext.prototype._throwIfFinalized = function () {
  if (this.finalized) {
    throw new Error(
      'This mutator has been finalized, and can no longer be accessed.',
    );
  }
};

MutationContext.prototype.get = function (prop) {
  this._throwIfFinalized();

  let children = this.children;
  if (!children) {
    children = Object.create(null);
    this.children = children;
  }

  let child = children[prop];
  if (child) {
    return child;
  }

  child = new MutationContext(
    this.result[prop],
    this,
    prop,
  );
  children[prop] = child;
  return child;
};

MutationContext.prototype.set = function (newValue) {
  this._throwIfFinalized();

  if (!Object.is(this.result, newValue)) {
    this.result = newValue;
    this._copyResultToParent();
  }

  return this.final();
};

MutationContext.prototype.run = function (cb) {
  this._throwIfFinalized();

  this._copyForWrite();

  cb(this.result);

  return this.final();
};

MutationContext.prototype.final = function () {
  if (this.finalized) {
    return this.result;
  }

  const children = this.children;
  if (children) {
    // children has no prototype
    for (const key in children) {
      children[key].final();
    }
  }

  const callbacks = this.callbacks;
  if (callbacks) {
    for (let i = callbacks.length - 1; i >= 0; i--) {
      const [callback, ...args] = callbacks[i];
      callback(...args);
    }
  }

  const parent = this.parent;
  if (parent) {
    delete parent.children[this.prop];
  }

  this.source = null;
  this.parent = null;
  this.prop = null;
  this.children = null;
  this.callbacks = null;
  this.finalized = true;

  return this.result;
};

export default MutationContext;
