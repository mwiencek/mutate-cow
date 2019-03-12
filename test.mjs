/*
 * @flow
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import mutate from './index.mjs';
import {
  PROXY_SUPPORT,
  PROXY_CONTEXT,
  noProxy,
} from './constants.mjs';

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

type Person = {
  name: string,
  birth_date: DatePeriod,
  death_date: DatePeriod,
};

type ReadOnlyPerson = {
  +name: string,
  +birth_date: ReadOnlyDatePeriod,
  +death_date: ReadOnlyDatePeriod,
};

type People = Array<Person>;
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

{ // object not copied if no writes are made

  const copy = mutate/*:: <Person, _>*/(alice, (copy) => {
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
  const copy = mutate/*:: <Person, _>*/(alice, (copy) => {
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
  let copy = mutate/*:: <Person, _>*/(frozenBob, (copy) => {
    copy.name;
    copy.birth_date.year;
    copy.death_date.year;
  });

  assert(copy === frozenBob);

  copy = mutate/*:: <Person, _>*/(frozenBob, (copy) => {
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

const people/*: ReadOnlyPeople */ = [alice, frozenBob];

{ // object not copied if no writes are made

  const copy = mutate/*:: <People, _>*/(people, (copy) => {
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

  const copy = mutate/*:: <{foo: number}, _>*/(orig, (copy) => {
    delete copy.foo;
  });

  assert(orig.foo === 1);
  assert(!copy.hasOwnProperty('foo'));
}

{ // overwriting a cloned object

  const orig = {foo: {bar: 1}};
  const bar3 = {bar: 3};

  const copy = mutate/*:: <{foo: {bar: number}}, _>*/(orig, (copy) => {
    copy.foo.bar = 2;
    assert(copy.foo.bar === 2);
    copy.foo = bar3;
    assert(copy.foo.bar === 3);
    copy.foo.bar = 4;
    assert(copy.foo.bar === 4);
    PROXY_SUPPORT && assert(bar3.bar === 3);
  });

  assert(orig.foo.bar === 1);
  assert(copy.foo.bar === 4);
}

{ // defineProperty

  const orig/*: {+foo?: number} */ = {};

  const copy = mutate/*:: <{foo:? number}, _>*/(orig, (copy) => {
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

  const copy = mutate/*:: <People, _>*/(people, (copy) => {
    assert(Array.isArray(copy));
    copy.push((alice/*: any */));
  });

  assert(copy !== people);
  assert(people.length === 2);
  assert(copy.length === 3);
  assert(copy[2] === alice);
}

{ // array delete

  const copy = mutate/*:: <People, _>*/(people, (copy) => {
    delete copy[1];
  });

  assert(copy !== people);
  assert(copy.length === 2);
  assert(copy[0] === alice);
  assert(copy[1] === undefined);
}

{ // splice
  let copy = mutate/*:: <People, _>*/(people, (copy) => {
    assert(Array.isArray(copy));
    copy.splice(0, 1);
  });

  assert(copy !== people);
  assert(people.length === 2);
  assert(copy.length === 1);
  PROXY_SUPPORT && assert(copy[0] === frozenBob);
}

if (PROXY_SUPPORT) { // objects are copied only once

  const copy = mutate/*:: <People, _>*/(people, (copy) => {
    const proxy1 = copy[0].death_date;
    proxy1.year = 5000;
    assert(proxy1 === copy[0].death_date); // proxy is unchanged
    const ref1 = PROXY_CONTEXT.get(proxy1).copy;
    assert(people[0].death_date !== ref1); // reference was copied
    assert(people[0].death_date.year === 2330);
    assert(proxy1.year === 5000);
    proxy1.year  = 4000;
    const ref2 = PROXY_CONTEXT.get(copy[0].death_date).copy;
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
type WeirdArray = {|+weird: boolean|} & $ReadOnlyArray<number>;
*/

{ // non-index array properties

  const weird/*: WeirdArray */ = (Object.defineProperty([1, 2, 3], ('weird'/*: any */), {
    configurable: false,
    enumerable: true,
    value: true,
    writable: false,
  })/*: any */);

  const weirdCopy = mutate/*:: <{|weird: boolean|} & Array<number>, _>*/(weird, (copy) => {
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

  const descArrayCopy = mutate/*:: <{value: Array<number>}, _>*/(descArray, (copy) => {
    copy.value[1] = 0;
  });

  assert(descArray.value[1] === 2);

  const newDesc1 = Object.getOwnPropertyDescriptor(descArrayCopy.value, 1);
  assert(!(newDesc1/*: any */).configurable);
  assert((newDesc1/*: any */).enumerable);
  assert((newDesc1/*: any */).value === 0);
  assert(!(newDesc1/*: any */).writable);
}

/*::
type SharedFoo = {foo: string};
*/

if (PROXY_SUPPORT) { // shared reference within one object

  const shared/*: $ReadOnly<SharedFoo> */ = {foo: ''};

  const object = {
    prop1: shared,
    prop2: shared,
  };

  const copy = mutate/*:: <{prop1: SharedFoo, prop2: SharedFoo}, _>*/(object, (copy) => {
    copy.prop1.foo = 'abc';
    assert(copy.prop1.foo === 'abc');
    assert(copy.prop2.foo === '');
    const ref = copy.prop1;
    assert(shared.foo === '');
    copy.prop2.foo = '123';
    assert(copy.prop1.foo === 'abc');
    assert(copy.prop2.foo === '123');
    assert(PROXY_CONTEXT.get(copy.prop1).copy === PROXY_CONTEXT.get(ref).copy); // copied only once
    assert(shared.foo === '');
  });

  assert(copy.prop1.foo === 'abc');
  assert(copy.prop2.foo === '123');
  assert(shared.foo === '');
}

/*::
type NestedShared = {foo: {foo: Array<number>}};
type ReadOnlyNestedShared = {+foo: {+foo: $ReadOnlyArray<number>}};
*/

{ // nested calls + shared reference across two objects

  const shared/*: {+foo: $ReadOnlyArray<number>} */ = {foo: [1]};
  const objectA/*: ReadOnlyNestedShared */ = {foo: shared};
  const objectB/*: ReadOnlyNestedShared */ = {foo: shared};

  const objectACopy = mutate/*:: <NestedShared, _>*/(objectA, (copyA) => {
    const objectBCopy = mutate/*:: <NestedShared, _>*/(objectB, (copyB) => {
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

  const copy = mutate/*:: <NiceClass, _>*/(instance, (copy) => {
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
    get value()/*: {foo?: number} */{
      return (this.object = this.object || {});
    },
    set value(x/*: {foo?: number} */)/*: void */{
      this.object = x;
    },
  };

  const copy1 = mutate/*:: <typeof orig, _>*/(orig, (copy) => {
    copy.value.foo = 1;
  });

  const newObject = {foo: 0};

  const copy2 = mutate/*:: <typeof orig, _>*/(orig, (copy) => {
    copy.value = newObject;
    assert(copy.value.foo === 0);
    // This should copy newObject; otherwise we'd be able to have
    // side-effects across multiple objects.
    copy.value.foo = 2;
    PROXY_SUPPORT && assert(newObject.foo === 0);
  });

  assert(orig.value.foo === undefined);
  assert(orig.value === orig.object);
  assert(copy1.value.foo === 1);
  assert(copy1.value === copy1.object);
  assert(copy2.value.foo === 2);
  assert(copy2.value === copy2.object);
}

{ // functions

  const origFunc = () => 'abc';

  const orig/*: {|+func: () => string|} */ = {
    func: origFunc,
  };

  const copy = mutate/*:: <{func: () => string}, _>*/(orig, (copy) => {
    assert(typeof copy.func === 'function');
    assert(copy.func instanceof Function);
    assert(copy.func() === 'abc');

    let error;
    try {
      copy.func.prop = true;
    } catch (e) {
      error = e;
    }

    // Can't clone functions, so the above should error.
    PROXY_SUPPORT && assert(error && error.message.includes('unsupported'));

    copy.func = () => '';
    assert(copy.func() === '');
  });
}

{ // null prorotypes

  const orig/*: {__proto__: null, +value: {__proto__: null, +number: number}} */ = Object.create(null, {
    value: {
      configurable: true,
      enumerable: true,
      value: Object.create(null, {
        number: {
          configurable: true,
          enumerable: true,
          value: 1,
          writable: false,
        },
      }),
      writable: false,
    },
  });

  const copy = mutate/*:: <{__proto__: null, value: {__proto__: null, number: number}}, _>*/(orig, (copy) => {
    copy.value.number = 2;
  });

  assert(orig.value.number === 1);
  assert(copy.value.number === 2);
  assert(Object.getPrototypeOf(copy) === null);
  assert(Object.getPrototypeOf(copy.value) === null);
}

{ // Number / String objects

  const orig/*: {+num: Number, +str: String} */ = {
    num: new Number(1),
    str: new String('hello'),
  };

  const copy = mutate/*:: <{num: Number, str: String}, _>*/(orig, (copy) => {
    let error;

    error = null;
    try {
      copy.num.valueOf();
    } catch (e) {
      error = e;
    }
    PROXY_SUPPORT && assert(error && error.message.includes('unsupported'));

    copy.num = new Number(orig.num.valueOf() + 2);

    error = null;
    try {
      copy.str[4] = 'p';
    } catch (e) {
      error = e;
    }
    PROXY_SUPPORT && assert(error && error.message.includes('unsupported'));
  });

  assert(orig.num.valueOf() === 1);
  assert(orig.str.valueOf() === 'hello');
  assert(copy.num.valueOf() === 3);
  assert(copy.str === orig.str);
}

{ // non-objects

  let error = null;
  try { mutate(null, () => {}) } catch (e) { error = e }
  PROXY_SUPPORT && assert(error && error.message === 'Expected an object to mutate');
}

{ // derived built-ins

  class FunDate extends Date {}

  let error = null;
  try {
    mutate(new FunDate(), (copy) => {
      copy.setFullYear(1999);
    });
  } catch (e) {
    error = e;
  }
  PROXY_SUPPORT && assert(error && error.message.includes('unsupported'));
}

/*::
type Cyclic = {x: Cyclic}
*/

{ // cyclic references

  const object/*: Cyclic */ = {};
  object.x = object;

  if (PROXY_SUPPORT) {
    const newObject = mutate(object, newObject => {
      newObject.x.x = null;
    });

    assert(object.x.x.x === object);
    assert(newObject.x.x === null);
  }

  noProxy(() => {
    let error;

    try {
      mutate(object, newObject => {
        newObject.x.x = null;
      });
    } catch (e) {
      error = e;
    }

    assert(error && error.message === 'Unexpected cyclic or shared reference');
  });
}
