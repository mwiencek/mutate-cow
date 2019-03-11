/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';

const hasOwnProperty = Object.prototype.hasOwnProperty;

export default function restoreEqual(orig, copy) {
  if (Object.is(orig, copy)) {
    return orig;
  }

  const _canClone = canClone(orig);
  if (_canClone !== canClone(copy)) {
    return copy;
  }

  if (!_canClone) {
    return copy;
  }

  const origKeys = Object.getOwnPropertyNames(orig);
  const copyKeys = Object.getOwnPropertyNames(copy);
  let equalKeyCount = 0;

  for (let i = 0; i < origKeys.length; i++) {
    const key = origKeys[i];

    if (!hasOwnProperty.call(orig, key) || !hasOwnProperty.call(copy, key)) {
      continue;
    }

    const origValue = orig[key];
    let copyValue = copy[key];

    copyValue = restoreEqual(origValue, copyValue);
    copy[key] = copyValue;

    if (Object.is(origValue, copyValue)) {
      equalKeyCount++;
    }
  }

  if (equalKeyCount === origKeys.length &&
      equalKeyCount === copyKeys.length) {
    return orig;
  }

  return copy;
}
