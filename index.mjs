/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import clone from './clone.mjs';
import {PROXY_SUPPORT} from './constants.mjs';
import restoreEqual from './restoreEqual.mjs';
import makeProxy, {Context, isObject} from './makeProxy.mjs';

export default function mutate(source, updater) {
  if (!isObject(source)) {
    throw new Error('Expected an object to mutate');
  }

  let copy = null;
  const callbacks = [];

  if (PROXY_SUPPORT) {
    const ctx = new Context(
      null,
      source,
      null,
      callbacks,
    );
    updater(makeProxy(ctx));
    copy = ctx.copy;
  } else {
    // Slow path for IE and other environments without Proxy
    copy = clone(source, callbacks, true, new Set());
    updater(copy);
    copy = restoreEqual(source, copy);
  }

  for (let i = callbacks.length - 1; i >= 0; i--) {
    callbacks[i]();
  }

  return copy || source;
}
