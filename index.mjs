/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import clone from './clone.mjs';
import {PROXY_SUPPORT} from './constants.mjs';
import restoreEqual from './restoreEqual.mjs';
import makeProxy, {isObject} from './makeProxy.mjs';

export default function mutate(source, updater) {
  if (!isObject(source)) {
    throw new Error('Expected an object to mutate');
  }

  let copy = null;
  const callbacks = [];

  if (PROXY_SUPPORT) {
    const proxy = makeProxy(source, () => {
      return copy || (copy = clone(source, callbacks));
    }, callbacks, false);
    updater(proxy);
  } else {
    // Slow path for IE and other environments without Proxy
    copy = clone(source, callbacks, true);
    updater(copy);
    copy = restoreEqual(source, copy);
  }

  for (let i = callbacks.length - 1; i >= 0; i--) {
    callbacks[i]();
  }

  return copy || source;
}
