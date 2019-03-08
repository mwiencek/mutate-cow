/*
 * @flow
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

'use strict';

import doMutate from './index.mjs';
import {PROXY_TARGETS} from './constants.mjs';

function assert(truth, message) {
  if (!truth) {
    throw new Error('assertion failed');
  }
}

/*::
type Person = {
  +name: string,
  +birth_date: {
    +year: number,
  },
  +death_date: {
    +year: number,
  },
};

type People = $ReadOnlyArray<Person>;
*/

const aliceBirthDate = {year: 2100};
const aliceDeathDate = {year: 2330};

const alice /*: Person */ = {
  name: 'Alice',
  birth_date: aliceBirthDate,
  death_date: aliceDeathDate,
};

const frozenBob /*: Person */ = Object.freeze({
  name: 'Bob',
  birth_date: Object.freeze({year: 2450}),
  death_date: Object.freeze({year: 2988}),
});

{ // object not copied if no writes are made

  const copy = doMutate(alice, (copy) => {
    assert('name' in copy);
    assert('birth_date' in copy);
    assert('death_date' in copy);
    assert('year' in copy.birth_date);
    assert('year' in copy.death_date);

    copy.name;
    copy.birth_date.year;
    copy.death_date.year;

    const properties = Object.getOwnPropertyNames(copy).sort();
    assert(properties.length === 3);
    assert(properties[0] === 'birth_date');
    assert(properties[1] === 'death_date');
    assert(properties[2] === 'name');
  });

  assert(alice === copy);
}

{
  const copy = doMutate(alice, (copy) => {
    assert(copy.birth_date.year === 2100);
    copy.birth_date.year = 1988;
    assert(copy.birth_date.year === 1988);
  });

  assert(copy !== alice);
  assert(copy.birth_date !== alice.birth_date);
  assert(copy.birth_date.year === 1988);
  assert(copy.death_date === aliceDeathDate);

  assert(alice.name === 'Alice');
  assert(alice.birth_date === aliceBirthDate);
  assert(alice.birth_date.year === 2100);
  assert(alice.death_date === aliceDeathDate);
  assert(alice.death_date.year === 2330);
}

{
  let copy = doMutate(frozenBob, (copy) => {
    copy.name;
    copy.birth_date.year;
    copy.death_date.year;
  });

  assert(copy === frozenBob);

  copy = doMutate(frozenBob, (copy) => {
    assert(copy.birth_date.year === 2450);
    copy.birth_date.year = 1988;
    assert(copy.birth_date.year === 1988);
  });

  assert(copy !== frozenBob);
  // frozenness is preserved
  assert(Object.isFrozen(copy));
  assert(copy.birth_date !== frozenBob.birth_date);
  assert(Object.isFrozen(copy.birth_date));
  assert(copy.birth_date.year === 1988);
  assert(copy.death_date === frozenBob.death_date);
}

const people/*: People */ = [alice, frozenBob];

{ // object not copied if no writes are made

  const copy = doMutate(people, (copy) => {
    copy[0].death_date.year;
    copy[1].death_date.year;
  });

  assert(people === copy);
  assert(people[0] === copy[0]);
  assert(people[1] === copy[1]);
  assert(people[0].birth_date === copy[0].birth_date);
  assert(people[1].death_date === copy[1].death_date);
}

{ // object delete

  const orig = {foo: 1};

  const copy = doMutate(orig, (copy) => {
    delete copy.foo;
  });

  assert(orig.foo === 1);
  assert(!copy.hasOwnProperty('foo'));
}

{ // defineProperty

  const orig/*: {+foo?: number} */ = {};

  const copy = doMutate(orig, (copy) => {
    Object.defineProperty(copy, 'foo', {
      configurable: false,
      enumerable: true,
      value: 1,
      writable: false,
    });
  });

  assert(!orig.hasOwnProperty('foo'));
  assert(copy.foo === 1);
}

{ // array push

  const copy = doMutate(people, (copy) => {
    assert(Array.isArray(copy));
    copy.push((alice/*: any */));
  });

  assert(copy !== people);
  assert(people.length === 2);
  assert(copy.length === 3);
  assert(copy[2] === alice);
}

{ // array delete

  const copy = doMutate(people, (copy) => {
    delete copy[1];
  });

  assert(copy !== people);
  assert(copy.length === 2);
  assert(copy[0] === alice);
  assert(copy[1] === undefined);
}

{ // splice
  let copy = doMutate(people, (copy) => {
    assert(Array.isArray(copy));
    copy.splice(0, 1);
  });

  assert(copy !== people);
  assert(people.length === 2);
  assert(copy.length === 1);
  assert(copy[0] === frozenBob);
}

{ // objects are copied only once

  const copy = doMutate(people, (copy) => {
    const proxy1 = copy[0].death_date;
    proxy1.year = 5000;
    assert(proxy1 === copy[0].death_date); // proxy is unchanged
    const ref1 = PROXY_TARGETS.get(proxy1);
    assert(people[0].death_date !== ref1); // reference was copied
    assert(people[0].death_date.year === 2330);
    assert(proxy1.year === 5000);
    proxy1.year  = 4000;
    const ref2 = PROXY_TARGETS.get(copy[0].death_date);
    assert(ref1 === ref2); // reference was copied only once
    assert(ref1.year === 4000);
    proxy1.year = 3000;
  });

  assert(copy[0] !== alice);
  assert(copy[0].birth_date === alice.birth_date);
  assert(copy[0].death_date !== aliceDeathDate);
  assert(copy[0].death_date.year === 3000);
  assert(copy[1] === frozenBob);
}

/*::
type WeirdArray = {weird: boolean} & Array<number>;
*/

{ // non-index array properties

  const weird/*: WeirdArray */ = (Object.defineProperty([1, 2, 3], ('weird'/*: any */), {
    configurable: false,
    enumerable: true,
    value: true,
    writable: false,
  })/*: any */);

  const weirdCopy = doMutate(weird, (copy) => {
    copy.push(666);
    assert(copy.weird === true, 'weird');
    copy.weird = false;
  });

  assert(weird !== weirdCopy, 'reference is changed');
  assert(weirdCopy.length === 4, 'item was added');
  assert(weirdCopy[3], 'added item is 666');
  assert(weird.length === 3, 'original reference is unchanged');
  assert(weird.weird === true, 'original reference is unchanged');
  assert(weirdCopy.weird === false, 'not weird');
}

{ // array property descriptors

  const descArray/*: {+value: Array<number>} */ = {value: [1, 2, 3]};

  Object.defineProperty(descArray.value, 1, {
    configurable: false,
    enumerable: true,
    value: 2,
    writable: false,
  });

  const descArrayCopy = doMutate(descArray, (copy) => {
    copy.value[1] = 0;
  });

  assert(descArray.value[1] === 2);

  const newDesc1 = Object.getOwnPropertyDescriptor(descArrayCopy.value, 1);
  assert(!(newDesc1/*: any */).configurable);
  assert((newDesc1/*: any */).enumerable);
  assert((newDesc1/*: any */).value === 0);
  assert(!(newDesc1/*: any */).writable);
}

{ // shared reference within one object

  const shared/*: {+foo: string} */ = {foo: ''};

  const object = {
    prop1: shared,
    prop2: shared,
  };

  const copy = doMutate(object, (copy) => {
    copy.prop1.foo = 'abc';
    assert(copy.prop1.foo === 'abc');
    assert(copy.prop2.foo === '');
    const ref = copy.prop1;
    assert(shared.foo === '');
    copy.prop2.foo = '123';
    assert(copy.prop1.foo === 'abc');
    assert(copy.prop2.foo === '123');
    assert(PROXY_TARGETS.get(copy.prop1) === PROXY_TARGETS.get(ref)); // copied only once
    assert(shared.foo === '');
  });

  assert(copy.prop1.foo === 'abc');
  assert(copy.prop2.foo === '123');
  assert(shared.foo === '');
}

{ // nested calls + shared reference across two objects

  const shared/*: {+foo: $ReadOnlyArray<number>} */ = {foo: [1]};
  const objectA = {foo: shared};
  const objectB = {foo: shared};

  const objectACopy = doMutate(objectA, (copyA) => {
    const objectBCopy = doMutate(objectB, (copyB) => {
      copyA.foo.foo[0] = 2;
      copyB.foo.foo[0] = 3;
      assert(copyA.foo.foo[0] === 2);
      assert(copyB.foo.foo[0] === 3);
    });
    assert(copyA.foo.foo[0] === 2);
    assert(objectBCopy.foo.foo[0] === 3);
  });

  assert(objectACopy.foo.foo[0] === 2);
}

{ // classes

  class NiceClass {
    /*::
    value: string;
    */

    constructor() {
      this.value = 'nice';
    }
  }

  const instance = new NiceClass();

  const copy = doMutate(instance, (copy) => {
    assert(copy instanceof NiceClass);
    copy.value = 'naughty';
  });

  assert(instance !== copy);
  assert(copy instanceof NiceClass);
  assert(copy.value === 'naughty');
  assert(instance.value === 'nice');
}

{ // getters and setters

  const orig = {
    object: null,
    get value()/*: {+foo?: number} */{
      return (this.object = this.object || {});
    },
    set value(x/*: {+foo?: number} */)/*: void */{
      this.object = x;
    },
  };

  const copy1 = doMutate(orig, (copy) => {
    copy.value.foo = 1;
  });

  const newObject = {foo: 0};

  const copy2 = doMutate(orig, (copy) => {
    copy.value = newObject;
    assert(copy.value.foo === 0);
    // This should copy newObject; otherwise we'd be able to have
    // side-effects across multiple objects.
    copy.value.foo = 2;
    assert(newObject.foo === 0);
  });

  assert(orig.value.foo === undefined);
  assert(orig.value === orig.object);
  assert(copy1.value.foo === 1);
  assert(copy1.value === copy1.object);
  assert(copy2.value.foo === 2);
  assert(copy2.value === copy2.object);
}
