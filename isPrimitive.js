/*
 * Copyright (c) 2021 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

export default function isPrimitive(value) {
  switch (typeof value) {
    case 'bigint':
    case 'boolean':
    case 'number':
    case 'string':
    case 'symbol':
    case 'undefined':
      return true;
    default:
      return value === null;
  }
}
