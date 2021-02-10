/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import Mutator from './Mutator';

export default function mutate(source) {
  return new Mutator(
    source,
    null,
    null,
    null,
  );
}
