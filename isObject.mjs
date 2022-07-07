/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

export default function isObject(value) {
  const type = typeof value;
  return value && (type === 'object' || type === 'function');
}
