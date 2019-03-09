/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

'use strict';

import clone from './clone.mjs';
import {EMPTY_ARRAY, PROXY_TARGETS} from './constants.mjs';

export default function makeProxy(source, getCopy, callbacks) {
  const proxyCache = new Map();

  // Using a fake proxy target avoids having to deal with proxy
  // invariants. See section 9.5.8 of
  // https://www.ecma-international.org/ecma-262/8.0/
  const isArray = Array.isArray(source);
  const fakeTarget = isArray
    ? EMPTY_ARRAY
    : Object.create(Object.getPrototypeOf(source));

  let copy;
  function copyForWrite() {
    if (!copy) {
      copy = getCopy();
      PROXY_TARGETS.set(proxy, copy);
    }
  }

  const proxy = new Proxy(fakeTarget, {
    // Since a `set` handler is defined, this should only be called
    // when `defineProperty` is called directly?
    defineProperty: function (obj, prop, desc) {
      copyForWrite();
      // Non-configurable properties must exist on the proxy target.
      if (desc.configurable === false && !fakeTarget.hasOwnProperty(prop)) {
        Reflect.defineProperty(fakeTarget, prop, desc);
      }
      return Reflect.defineProperty(copy, prop, desc);
    },

    deleteProperty: function (obj, prop) {
      copyForWrite();
      return Reflect.deleteProperty(copy, prop);
    },

    get: function (obj, prop) {
      const desc = Object.getOwnPropertyDescriptor(copy || source, prop);
      let value;

      if (desc) {
        if (desc.get) {
          return desc.get.call(proxy, prop);
        }
        value = desc.value;
      } else {
        return Reflect.get(copy || source, prop);
      }

      if (value instanceof Object) {
        let p = proxyCache.get(prop);
        if (p) {
          return p;
        }

        p = makeProxy(value, () => {
          copyForWrite();
          return (copy[prop] = clone(value, callbacks));
        }, callbacks);

        proxyCache.set(prop, p);
        return p;
      }
      return value;
    },

    getOwnPropertyDescriptor: function (obj, prop) {
      const desc = Object.getOwnPropertyDescriptor(copy || source, prop);
      if (desc && (!isArray || prop !== 'length')) {
        desc.configurable = true;
        if (!desc.get && !desc.set) {
          desc.writable = true;
        }
      }
      return desc;
    },

    has: function (obj, prop) {
      return Reflect.has(copy || source, prop);
    },

    ownKeys: function (obj) {
      return Reflect.ownKeys(copy || source);
    },

    set: function (obj, prop, value) {
      copyForWrite();
      if (value instanceof Object) {
        value = PROXY_TARGETS.get(value) || value;
      }
      copy[prop] = value;
      return true;
    },
  });

  PROXY_TARGETS.set(proxy, source);
  return proxy;
}
