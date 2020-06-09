/*
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import Benchmark from 'benchmark';
import mutate from './main';

const root = {};
for (let i = 65, next = root; i <= 90; i++) {
  next = next[String.fromCharCode(i)] = {
    prop1: 1,
    prop2: 2,
    prop3: 3,
    prop4: 4,
    prop4: 5,
  };
}

const updater1 = (newRoot) => {
  newRoot.root = true;
};

const updater2 = (newRoot) => {
  newRoot.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S.T.U.V.W.X.Y.Z.leaf = true;
};

function test() {
  mutate(root, updater1); // shallow update
  mutate(root, updater2); // deep update
}

new Benchmark.Suite()
  .add('test', test)
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({async: true});
