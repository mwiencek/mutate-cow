/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import {PROXY_UNWRAP_KEY} from './constants';
import isObject from './isObject';

export default function unwrap(value) {
  if (isObject(value)) {
    const result = value[PROXY_UNWRAP_KEY];
    if (result) {
      return result;
    }
  }
  return value;
}
