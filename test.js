/*
 * @flow
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import mutate from './main';

function assert(truth, message) {
  if (!truth) {
    throw new Error('assertion failed');
  }
}

/*::
type DatePeriod = {
  year: number,
};

type ReadOnlyDatePeriod = {
  +year: number,
};

type ReadOnlyPerson = {
  +name: string,
  +birth_date: ReadOnlyDatePeriod,
  +death_date: ReadOnlyDatePeriod,
};

type ReadOnlyPeople = $ReadOnlyArray<ReadOnlyPerson>;
*/

const aliceBirthDate = {year: 2100};
const aliceDeathDate = {year: 2330};

const alice /*: ReadOnlyPerson */ = {
  name: 'Alice',
  birth_date: aliceBirthDate,
  death_date: aliceDeathDate,
};

const frozenBob /*: ReadOnlyPerson */ = Object.freeze({
  name: 'Bob',
  birth_date: Object.freeze({year: 2450}),
  death_date: Object.freeze({year: 2988}),
});

{ // simple write
  const mutator = mutate/*:: <ReadOnlyPerson>*/(alice);

  mutator.get('birth_date').get('year').set(1988);

  const result = mutator.result;
  assert(result !== alice);
  assert(result.birth_date !== alice.birth_date);
  assert(result.birth_date.year === 1988);
  assert(result.death_date === aliceDeathDate);

  // original object is unchanged
  assert(alice.name === 'Alice');
  assert(alice.birth_date === aliceBirthDate);
  assert(alice.birth_date.year === 2100);
  assert(alice.death_date === aliceDeathDate);
  assert(alice.death_date.year === 2330);

  const copy = mutator.final();
  assert(copy === result);
}

{ // object not copied if no writes are made

  const mutator = mutate/*:: <ReadOnlyPerson>*/(alice);

  mutator.get('birth_date').set(alice.birth_date);
  mutator.get('death_date').set(alice.death_date);

  const copy = mutator.final();
  assert(alice === copy);
  assert(alice.birth_date === copy.birth_date);
  assert(alice.death_date === copy.death_date);
  assert(copy.birth_date.year === 2100);
  assert(copy.death_date.year === 2330);
}

{ // frozenness is preserved
  const mutator = mutate/*:: <ReadOnlyPerson>*/(frozenBob);

  mutator.get('birth_date').get('year').set(1988);
  assert(mutator.result.birth_date.year === 1988);

  const copy = mutator.final();
  assert(copy !== frozenBob);

  assert(Object.isFrozen(copy));
  assert(copy.birth_date !== frozenBob.birth_date);
  assert(Object.isFrozen(copy.birth_date));
  assert(copy.birth_date.year === 1988);
  assert(copy.death_date === frozenBob.death_date);
}

const people/*: ReadOnlyPeople */ = Object.freeze([alice, frozenBob]);

{ // object delete

  const orig = {};

  Object.defineProperty(orig, 'foo', {
    configurable: false,
    enumerable: true,
    writable: true,
    value: 1,
  });

  Object.defineProperty(orig, 'bar', {
    configurable: false,
    enumerable: true,
    writable: true,
    value: 2,
  });

  Object.defineProperty(orig, 'baz', {
    configurable: true,
    enumerable: true,
    writable: false,
    value: 3,
  });

  const mutator = mutate/*:: <{foo?: number, bar?: number, baz?: number}> */(orig);

  mutator.run(x => {
    delete x.foo;
    delete x.bar;
    delete x.baz;
  });

  assert(orig.foo === 1);
  assert(orig.bar === 2);
  assert(orig.baz === 3);

  const copy = mutator.final();
  assert(!copy.hasOwnProperty('foo'));
  assert(!copy.hasOwnProperty('bar'));
  assert(!copy.hasOwnProperty('baz'));
}

{ // re-using mutators is not allowed

  const orig = {foo: {bar: 1}};

  const mutator = mutate/*:: <{foo: {bar: number}}, _>*/(orig);
  const fooMutator = mutator.get('foo');
  const barMutator = fooMutator.get('bar');

  // this clones orig and orig.foo
  barMutator.set(2);
  assert(mutator.result.foo.bar === 2);

  // override the orig.foo clone with our own
  const ourFoo = Object.freeze({bar: 3});
  fooMutator.set(ourFoo);
  assert(mutator.result.foo.bar === 3);

  // barMutator is finalized - mutators can only be set once
  let error;
  try {
    barMutator.set(4);
  } catch (e) {
    error = e;
  }
  assert(
    error &&
    error.message === 'This mutator has been finalized, and can no longer be accessed.'
  );

  mutator.get('foo').get('bar').set(4);

  const copy = mutator.final();
  assert(copy.foo.bar === 4);
  assert(orig.foo.bar === 1);
  assert(ourFoo.bar === 3);
}

{ // arrays

  const mutator = mutate/*:: <ReadOnlyPeople>*/(people);

  mutator.run(x => {
    x.push(alice);
    x.splice(0, 1);
  });

  const copy = mutator.final();
  assert(Array.isArray(copy));
  assert(copy !== people);
  assert(copy.length === 2);
  assert(copy[0] === frozenBob);
  assert(copy[1] === alice);
}

{ // objects are copied only once

  const mutator = mutate(people);

  const deathDateMutator = mutator.get(0).get('death_date');
  deathDateMutator.get('year').set(5000);
  const deathDateCopy = deathDateMutator.result;
  assert(deathDateCopy === mutator.result[0].death_date);

  assert(people[0].death_date !== deathDateCopy); // reference was copied
  assert(people[0].death_date.year === 2330);
  assert(deathDateCopy.year === 5000);
  assert(deathDateMutator.get('year').result === 5000);

  deathDateMutator.get('year').set(4000);
  // reference was copied only once
  assert(deathDateCopy === mutator.result[0].death_date);
  assert(deathDateCopy.year === 4000);
  assert(deathDateMutator.get('year').result === 4000);

  deathDateMutator.get('year').set(3000);

  const copy = mutator.final();
  assert(copy[0] !== alice);
  assert(copy[0].birth_date === alice.birth_date);
  assert(copy[0].death_date !== aliceDeathDate);
  assert(copy[0].death_date.year === 3000);
  assert(copy[1] === frozenBob);
}

/*::
type WeirdArray = $ReadOnlyArray<number> & {+weird: boolean};
*/

{ // non-index array properties

  const weird/*: WeirdArray */ = (Object.defineProperty([1, 2, 3], ('weird'/*: any */), {
    configurable: false,
    enumerable: true,
    value: true,
    writable: false,
  })/*: any */);

  const mutator = mutate(weird);
  // $FlowIgnore[incompatible-use]
  mutator.get('weird').set(false);

  mutator.run(x => {
    x.push(666);
  });

  const copy = mutator.final();
  assert(weird !== copy, 'reference is changed');
  assert(copy.length === 4, 'item was added');
  assert(copy[3] === 666, 'added item is 666');
  assert(weird.length === 3, 'original reference is unchanged');
  assert(weird.weird === true, 'original reference is unchanged');
  assert(copy.weird === false, 'not weird');
}

{ // array property descriptors

  const descArray/*: {+value: Array<number>} */ = {value: [1, 2, 3]};

  Object.defineProperty(descArray.value, 1, {
    configurable: false,
    enumerable: true,
    value: 2,
    writable: false,
  });

  const descArrayMutator = mutate(descArray);
  descArrayMutator.get('value').run(x => {
    x[1] = 0;
  });

  const copy = descArrayMutator.final();
  const desc = Object.getOwnPropertyDescriptor(copy.value, 1);

  assert(desc);
  /*:: if (!desc) throw ''; */

  assert(!desc.configurable);
  assert(desc.enumerable);
  assert(desc.value === 0);
  assert(!desc.writable);
}

/*::
type SharedFoo = {+foo: string};
*/

{ // shared reference within one object

  const shared/*: SharedFoo */ = {foo: ''};

  const object/*: {+prop1: SharedFoo, +prop2: SharedFoo} */ = {
    prop1: shared,
    prop2: shared,
  };

  const mutator = mutate(object);
  mutator.get('prop1').get('foo').set('abc');

  const copy = mutator.final();
  assert(shared.foo === '');
  assert(copy.prop1.foo === 'abc');
  assert(copy.prop2 === shared);
}

{ // classes

  class NiceBase {}

  class NiceClass extends NiceBase {
    /*::
    value: string;
    */

    constructor() {
      super();
      this.value = 'nice';
    }
  }

  const instance = new NiceClass();
  const mutator = mutate(instance);
  // $FlowIssue[prop-missing]
  mutator.get('value').set('naughty');

  const copy = mutator.final();
  assert(instance !== copy);
  assert(copy instanceof NiceClass);
  assert(copy.value === 'naughty');
  assert(instance.value === 'nice');
}

{ // getters and setters

  const orig = {
    object: null,
    get value()/*: {foo?: number} */{
      return (this.object = this.object || {});
    },
    set value(x/*: {foo?: number} */)/*: void */{
      this.object = x;
    },
  };

  const mutator = mutate(orig);
  mutator.get('value').get('foo').set(1);

  const copy = mutator.final();
  assert(orig.value.foo === undefined);
  assert(orig.value === orig.object);
  assert(copy.value.foo === 1);
  assert(copy.value === copy.object);
}

{ // null prorotypes

  const orig/*: {__proto__: null, +value: number} */ = Object.create(null, {
    value: {
      configurable: true,
      enumerable: true,
      value: 1,
      writable: false,
    },
  });

  const mutator = mutate(orig);
  mutator.get('value').set(2);

  const copy = mutator.final();
  assert(orig.value === 1);
  assert(copy.value === 2);
  assert(Object.getPrototypeOf(copy) === null);
}

{ // primitives

  assert(mutate(1).set(null) === null);
  assert(mutate(1).set(undefined) === undefined);
  assert(mutate(1).set('') === '');
}

{ // built-ins

  const checkForError = /*:: <T> */(value/*: T */) => {
    let error = null;
    try {
      const mutator = mutate(value);
      mutator.run(x => undefined);
    } catch (e) {
      error = e;
    }
    assert(
      error &&
      error.message === 'Only simple arrays and objects can be cloned.'
    );
  };

  class FunDate extends Date {}
  checkForError(new FunDate());

  checkForError(new Number(1));
  checkForError(new String('hello'));
  checkForError(x => x);
}

/*::
type Cyclic = {x: Cyclic}
*/

{ // cyclic references

  const object/*: Cyclic */ = {};
  object.x = object;

  const mutator = mutate(object);
  // $FlowIgnore[incompatible-call]
  mutator.get('x').get('x').set(null);

  const copy = mutator.final();
  assert(object.x.x.x === object);
  assert(copy.x.x === null);
}
