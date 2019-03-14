/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import clone from './clone.mjs';
import {PROXY_SUPPORT} from './constants.mjs';
import isObject from './isObject.mjs';
import restoreEqual from './restoreEqual.mjs';
import makeProxy, {Context} from './makeProxy.mjs';
import unwrap from './unwrap.mjs';

export default function mutate(source, updater) {
  if (!isObject(source)) {
    throw new Error('Expected an object to mutate');
  }

  let copy = null;
  const callbacks = [];

  if (PROXY_SUPPORT) {
    const ctx = new Context(
      null,
      null,
      source,
      null,
    );
    ctx.root = ctx;
    ctx.callbacks = callbacks;
    updater(makeProxy(ctx), unwrap);
    copy = ctx.currentTarget;
    ctx.revoke();
  } else {
    // Slow path for IE and other environments without Proxy
    copy = clone(source, callbacks, true, new Set());
    updater(copy, unwrap);
    copy = restoreEqual(source, copy);
  }

  for (let i = callbacks.length - 1; i >= 0; i--) {
    callbacks[i]();
  }

  return copy;
}
