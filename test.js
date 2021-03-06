/*
 * @flow
 * Copyright (c) 2019 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

import mutate from './main';
import {PROXY_UNWRAP_KEY} from './constants';

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

{ // object not copied if assignments don't change the underlying data

  const copy = mutate/*:: <People, _>*/(people, (copy) => {
    copy[0] = copy[0];
    copy[0].birth_date = copy[0].birth_date;
    copy[0].birth_date.year = copy[0].birth_date.year;
    copy[0].birth_date.year = 2100;
  });

  assert(people === copy);
  assert(people[0] === copy[0]);
  assert(people[1] === copy[1]);
  assert(people[0].birth_date === copy[0].birth_date);
  assert(people[1].death_date === copy[1].death_date);
  assert(copy[0].birth_date.year === 2100);
}

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

  const copy = mutate/*:: <{foo?: number, bar?: number, baz?: number}, _>*/(orig, (copy) => {
    delete copy.foo;
    delete copy.bar;
    delete copy.baz;
  });

  assert(orig.foo === 1);
  assert(orig.bar === 2);
  assert(orig.baz === 3);
  assert(!copy.hasOwnProperty('foo'));
  assert(!copy.hasOwnProperty('bar'));
  assert(!copy.hasOwnProperty('baz'));
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
    assert(bar3.bar === 3);
  });

  assert(orig.foo.bar === 1);
  assert(copy.foo.bar === 4);
}

{ // defineProperty

  const orig/*: {+foo?: number, bar?: number} */ = {};

  Object.defineProperty(orig, 'bar', {
    configurable: false,
    enumerable: true,
    value: 0,
    writable: false,
  });

  const copy = mutate/*:: <{foo?: number, bar?: number}, _>*/(orig, (copy) => {
    let desc = Reflect.getOwnPropertyDescriptor(copy, 'bar');
    // read-only properties are configurable and writable inside `mutate`
    assert(desc && desc.configurable);
    assert(desc && desc.writable);
    copy.bar = 1;

    // read-only properties defined inside `mutate` stay read-only
    Object.defineProperty(copy, 'foo', {
      configurable: false,
      enumerable: true,
      value: 1,
      writable: false,
    });

    desc = Reflect.getOwnPropertyDescriptor(copy, 'foo');
    let error;
    try {
      copy.foo = 2;
    } catch (e) {
      error = e;
    }
    assert(error && error.message.includes('read only property'));
  });

  assert(!orig.hasOwnProperty('foo'));
  assert(orig.bar === 0);
  assert(copy.bar === 1);
  assert(Reflect.getOwnPropertyDescriptor(copy, 'bar').configurable === false);
  assert(Reflect.getOwnPropertyDescriptor(copy, 'bar').writable === false);
  assert(copy.foo === 1);
  assert(Reflect.getOwnPropertyDescriptor(copy, 'foo').configurable === false);
  assert(Reflect.getOwnPropertyDescriptor(copy, 'foo').writable === false);
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
  assert(copy[0] === frozenBob);
}

{ // objects are copied only once

  const copy = mutate/*:: <People, _>*/(people, (copy) => {
    const proxy1 = copy[0].death_date;
    proxy1.year = 5000;
    assert(proxy1 === copy[0].death_date); // proxy is unchanged
    const ref1 = proxy1[PROXY_UNWRAP_KEY];
    assert(people[0].death_date !== ref1); // reference was copied
    assert(people[0].death_date.year === 2330);
    assert(proxy1.year === 5000);
    proxy1.year  = 4000;
    const ref2 = copy[0].death_date[PROXY_UNWRAP_KEY];
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
    let desc = Object.getOwnPropertyDescriptor(copy.value, 'length');
    assert(desc && desc.configurable === false);
    assert(desc && desc.writable === true);
    copy.value[1] = 0;
    desc = Object.getOwnPropertyDescriptor(copy.value, 'length');
    assert(desc && desc.configurable === false);
    assert(desc && desc.writable === true);
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

{ // shared reference within one object

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
    assert(copy.prop1[PROXY_UNWRAP_KEY] === ref[PROXY_UNWRAP_KEY]); // copied only once
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

{ // nested call on proxied object

  const source/*: {+foo: {+bar: number}} */ = {foo: {bar: 0}};

  const copy = mutate/*:: <{foo: {bar: number}}, _>*/(source, copy => {
    copy.foo.bar++;

    copy.foo = mutate/*:: <{bar: number}, _>*/(copy.foo, fooCopy => {
      copy.foo.bar++; // overridden
      fooCopy.bar++;
      copy.foo.bar++; // overridden
    });

    copy.foo.bar++;
  });

  assert(copy.foo.bar === 3);
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
    assert(newObject.foo === 0);
  });

  assert(orig.value.foo === undefined);
  assert(orig.value === orig.object);
  assert(copy1.value.foo === 1);
  assert(copy1.value === copy1.object);
  assert(copy2.value.foo === 2);
  assert(copy2.value === copy2.object);
}

{ // functions

  const origFunc = function () {
    return this.value;
  };

  const orig/*: {|+func: () => string, +value: string|} */ = {
    func: origFunc,
    value: 'abc',
  };

  const copy = mutate/*:: <{func: (() => string) & {prop?: boolean}, value: string}, _>*/(orig, (copy) => {
    assert(typeof copy.func === 'function');
    assert(copy.func instanceof Function);
    assert(copy.func() === 'abc');
    copy.value = '123';
    assert(copy.func() === '123');

    let error;
    try {
      copy.func.prop = true;
    } catch (e) {
      error = e;
    }

    // Can't clone functions, so the above should error.
    assert(error && error.message.includes('unsupported'));

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
    assert(error && error.message.includes('unsupported'));

    copy.num = new Number(orig.num.valueOf() + 2);

    error = null;
    try {
      copy.str[4] = 'p';
    } catch (e) {
      error = e;
    }
    assert(error && error.message.includes('unsupported'));
  });

  assert(orig.num.valueOf() === 1);
  assert(orig.str.valueOf() === 'hello');
  assert(copy.num.valueOf() === 3);
  assert(copy.str === orig.str);
}

{ // non-objects

  let error = null;
  try { mutate(null, () => {}) } catch (e) { error = e }
  assert(error && error.message === 'Expected an object to mutate');
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
  assert(error && error.message.includes('unsupported'));
}

/*::
type Cyclic = {x: Cyclic}
*/

{ // cyclic references

  const object/*: Cyclic */ = {};
  object.x = object;

  const newObject = mutate(object, newObject => {
    newObject.x.x = null;
  });

  assert(object.x.x.x === object);
  assert(newObject.x.x === null);
}

{ // using a copy reference in an object spread

  const orig/*: any */ = {
    foo: {
      bar: {
        baz: 1,
      },
      func: function () {
        return this;
      },
    },
  };

  let copy = mutate/*:: <any, _>*/(orig, (copy) => {
    copy.foo = {...copy.foo};
  });

  let error = null;
  try {
    copy.foo.bar.baz;
  } catch (e) {
    error = e;
  }
  assert(error && error.message.includes('forgotten to call unwrap'));

  // Check that the error can trigger twice
  try {
    copy.foo.bar.baz;
  } catch (e) {
    error = e;
  }
  assert(error && error.message.includes('forgotten to call unwrap'));

  copy = mutate/*:: <any, _>*/(orig, (copy, unwrap) => {
    copy.foo = {...unwrap(copy.foo)};
    assert(copy.foo.func() === copy.foo);
  });

  assert(copy.foo.func() === copy.foo);
  assert(copy.foo.bar === orig.foo.bar);
}

{ // construct

  function Cls() {
    this.foo = 1;
  }

  const orig = {
    Cls,
  };

  const copy = mutate(orig, (copy) => {
    const c = new copy.Cls();
    assert(c instanceof Cls);
    assert(c.foo === 1);
  });
}

{ // Object.freeze on a proxied object

  // Arrays are somewhat special, because Object.freeze will attempt to make
  // the `length` property non-configurable and non-writable via the
  // defineProperty trap. However, a non-configurable property "cannot be
  // non-writable, unless there exists a corresponding non-configurable,
  // non-writable own property on the target object," i.e. our fake proxy
  // target.
  const copy = mutate([0], copy => {
    Object.freeze(copy);

    const desc = Object.getOwnPropertyDescriptor(copy, 'length');
    assert(desc && !desc.configurable);
    assert(desc && !desc.writable);

    let error;
    try {
      copy.error = true;
    } catch (e) {
      error = e;
    }
    assert(error && error.message.includes('not extensible'));
    assert(Object.isExtensible(copy) === false);
  });
  assert(Object.isExtensible(copy) === false);
}

{ // Assigning an externally-frozen object inside the proxy

  const source = {ref: null};
  const frozenRef = {name: ''};
  Object.freeze(frozenRef);

  const copy = mutate/*:: <{ref: {name: string}}, _>*/(source, copy => {
    copy.ref = frozenRef;
    copy.ref.name = 'hi';
  });
  assert(copy.ref && copy.ref.name === 'hi');
}
