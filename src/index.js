/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import throwIfNotCloneable from './throwIfNotCloneable.js';
import CowContext from './CowContext.js';

export default function mutate(source) {
  throwIfNotCloneable(source);
  return new CowContext(source, null, null, null);
}
