/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import {
  CANNOT_CLONE_ERROR,
  PROXY_UNWRAP_KEY,
} from './constants';
import isObject from './isObject';
import makeProxy, {Context} from './makeProxy';
import unwrap from './unwrap';

export default function mutate(source, updater) {
  if (!isObject(source)) {
    throw new Error('Expected an object to mutate');
  }

  let copy = null;
  const callbacks = [];

  const ctx = new Context(
    null,
    null,
    null,
  );
  const proxy = makeProxy(
    ctx,
    source[PROXY_UNWRAP_KEY] || source,
    callbacks,
  );
  updater(proxy, unwrap);
  copy = proxy[PROXY_UNWRAP_KEY];
  ctx.revoke();

  for (let i = callbacks.length - 1; i >= 0; i--) {
    const [callback, ...args] = callbacks[i];
    callback(...args);
  }

  return copy;
}
