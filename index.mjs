/*
 * @flow
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import clone from './clone.mjs';
import makeProxy, {isObject} from './makeProxy.mjs';

export default function mutate/*:: <Rw, Ro> */(
  source/*: Ro */,
  updater/*: (Rw) => void */,
)/*: Ro */{
  if (!isObject(source)) {
    throw new Error('Expected an object to mutate');
  }

  let copy;

  const callbacks = [];

  const proxy/*: Rw */ = makeProxy(source, () => {
    return copy || (copy = clone(source, callbacks));
  }, callbacks);

  updater(proxy);

  for (let i = callbacks.length - 1; i >= 0; i--) {
    callbacks[i]();
  }

  return copy || source;
}
