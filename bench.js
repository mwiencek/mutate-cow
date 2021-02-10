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

const updater1 = () => {
  const m = mutate(root);
  m.get('root').set(true);
  m.final();
};

const updater2 = () => {
  const m = mutate(root);
  m
    .get('A')
    .get('B')
    .get('C')
    .get('D')
    .get('E')
    .get('F')
    .get('G')
    .get('H')
    .get('I')
    .get('J')
    .get('K')
    .get('L')
    .get('M')
    .get('N')
    .get('O')
    .get('P')
    .get('Q')
    .get('R')
    .get('S')
    .get('T')
    .get('U')
    .get('V')
    .get('W')
    .get('X')
    .get('Y')
    .get('Z')
    .get('leaf')
    .set(true);
  m.final();
};

function test() {
  updater1(); // shallow update
  updater2(); // deep update
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
