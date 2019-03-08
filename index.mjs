/*
 * @flow
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

'use strict';

import clone from './clone.mjs';
import makeProxy from './makeProxy.mjs';

/*::
declare type MakeWritable =
  & (<V, X, T: $ReadOnlyArray<V> & X>(T) => Array<Writable<V>> & X)

  // {...$Exact<T>} removes the property variance.
  // {...T} doesn't work because it makes all the properties optional.

  & (<T: {...}>(T) => $ObjMap<{...$Exact<T>}, MakeWritable>)

  & (<T>(T) => T)
  ;

declare type Writable<T> = $Call<MakeWritable, T>;
*/

export default function doMutate/*:: <T: {...} | $ReadOnlyArray<mixed>> */(
  source/*: T */,
  updater/*: (Writable<T>) => void */,
)/*: T */ {
  let copy;

  const callbacks = [];

  const proxy = makeProxy(source, () => {
    return copy || (copy = clone(source, callbacks));
  }, callbacks);

  updater(proxy);

  for (let i = callbacks.length - 1; i >= 0; i--) {
    callbacks[i]();
  }

  return copy || source;
}
