/*
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import Benchmark from 'benchmark';
import {produce} from 'immer';
import mutate from '../src/index.js';

function* aToZ() {
  for (let i = 65; i <= 90; i++) {
    yield String.fromCharCode(i);
  }
}

const root = {};
let next = root;
for (const letter of aToZ()) {
  next = next[letter] = {
    prop0: 0,
    prop1: 1,
    prop2: 2,
    prop3: 3,
    prop4: 4,
    prop5: 5,
    prop6: 6,
    prop7: 7,
    prop8: 8,
    prop9: 9,
  };
}

function mutateCowUpdater() {
  const rootCtx = mutate(root);
  let childCtx = rootCtx;
  for (const letter of aToZ()) {
    childCtx = childCtx.get(letter);
    for (let i = 0; i < 10; i++) {
      childCtx.set('prop' + String(i), i + 1);
    }
  }
  rootCtx.final();
}

function immerUpdater() {
  produce(root, rootDraft => {
    let childDraft = rootDraft;
    for (const letter of aToZ()) {
      childDraft = childDraft[letter];
      for (let i = 0; i < 10; i++) {
        childDraft['prop' + String(i)] = i + 1;
      }
    }
  });
}

function objectSpreadUpdater() {
  let result = {...root};
  let child = result;
  for (const letter of aToZ()) {
    const parent = child;
    child = {...child[letter]};
    for (let i = 0; i < 10; i++) {
      child['prop' + String(i)] = i + 1;
    }
    parent[letter] = child;
  }
}

new Benchmark.Suite()
  .add('mutate-cow', mutateCowUpdater)
  .add('immer', immerUpdater)
  .add('object spread', objectSpreadUpdater)
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({async: true});
