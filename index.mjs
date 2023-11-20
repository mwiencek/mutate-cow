/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import canClone from './canClone.mjs';
import CowContext from './CowContext.mjs';

export default function mutate(source) {
  canClone(source);
  return new CowContext(source, null, null, null);
}
