/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import {PROXY_CONTEXT} from './constants.mjs';
import isObject from './isObject.mjs';

export default function unwrap(value) {
  if (isObject(value)) {
    const valueCtx = PROXY_CONTEXT.get(value);
    if (valueCtx) {
      return valueCtx.currentTarget;
    }
  }
  return value;
}
