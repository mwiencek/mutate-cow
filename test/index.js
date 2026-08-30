/*
 * @flow strict
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

// $FlowExpectedError[cannot-resolve-module]
import assert from 'node:assert/strict';
// $FlowExpectedError[cannot-resolve-module]
import test from 'node:test';
// $FlowExpectedError[cannot-resolve-module]
import vm from 'node:vm';

import mutate from '../src/index.js';

/*:: import * as types from '../src/index.js'; */

const ERROR_REVOKED =
  /^Error: This context has been revoked and can no longer be used\.$/;

const ERROR_CLONE =
  /^Error: Only plain objects and arrays can be cloned\./;

// $FlowFixMe[incompatible-type]
const SYMBOL_KEY = Symbol()/*:: as 'symbol' */;

/*::
type DatePeriod = {
  year: number,
};

type ReadOnlyDatePeriod = {
  readonly year: number,
  readonly month?: number,
  readonly day?: number,
};

type Person = {
  name: string,
  birth_date: DatePeriod,
  death_date: DatePeriod,
};

type ReadOnlyPerson = {
  readonly name: string,
  readonly birth_date: ReadOnlyDatePeriod,
  readonly death_date: ReadOnlyDatePeriod,
};

type People = Array<Person>;
type ReadOnlyPeople = ReadonlyArray<ReadOnlyPerson>;
*/

const aliceBirthDate = Object.freeze({year: 2100});
const aliceDeathDate = Object.freeze({year: 2330});

const alice /*: ReadOnlyPerson */ = Object.freeze({
  name: 'Alice',
  birth_date: aliceBirthDate,
  death_date: aliceDeathDate,
});

const people/*: ReadOnlyPeople */ = Object.freeze([alice, alice]);

const unsupportedProperties/*: {
  _value: string,
  readonly func: () => string,
  readonly numberObject: Number,
  readonly stringObject: String,
  readonly dateObject: Date,
  readonly typedArrayObject: Int8Array,
  readonly regExpObject: RegExp,
  readonly mapObject: Map<empty, empty>,
  readonly setObject: Set<empty>,
} */ = {
  _value: '',
  func: () => '',
  numberObject: new Number(1),
  stringObject: new String(''),
  dateObject: new Date(),
  typedArrayObject: new Int8Array([]),
  regExpObject: new RegExp(''),
  mapObject: new Map(),
  setObject: new Set(),
};

test('read', (t) => {
  t.test('returns the original value if no changes were made', (t) => {
    assert.equal(mutate(people).read()[0].birth_date.year, 2100);
  });

  t.test('returns the current changes', (t) => {
    const ctx = mutate(people);
    ctx.set(0, 'birth_date', 'year', 1988);
    assert.equal(ctx.read()[0].birth_date.year, 1988);
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.read();
    }, ERROR_REVOKED);
  });
});

test('write', (t) => {
  t.test('forces a copy even if no changes are made', (t) => {
    const copy = mutate(alice).update(ctx => ctx.write()).final();
    assert.notEqual(copy, alice);
  });

  t.test('returns the current changes', (t) => {
    const ctx = mutate(people);
    ctx.set(0, 'birth_date', 'year', 1988);
    assert.equal(ctx.write()[0].birth_date.year, 1988);
  });

  t.test('allows pushing array values', (t) => {
    const copy = mutate(people)
      .update((ctx) => ctx.write().push(alice))
      .final();
    assert.equal(copy[2], alice);
  });

  t.test('can be called on child primitives', (t) => {
    const ctx = mutate(alice);
    ctx.get('birth_date', 'year').write();
    // $FlowExpectedError[cannot-write]
    ctx.read().birth_date.year = 1988;
    const copy = ctx.final();
    assert.equal(copy.birth_date.year, 1988);
  });

  t.test('throws if you pass a derived built-in', (t) => {
    class FunDate extends Date {}
    assert.throws(() => {
      mutate(new FunDate()).write();
    }, ERROR_CLONE);
  });

  t.test('throws if you pass a generator', (t) => {
    function* makeGenerator() {
      yield 1;
    }
    assert.throws(() => {
      mutate(makeGenerator()).write();
    }, ERROR_CLONE);
  });

  t.test('throws if you pass an uncloneable object with a primitive constructor', (t) => {
    const obj = new Date();
    // $FlowExpectedError[cannot-write]
    obj.constructor = 'foo';
    assert.throws(() => {
      mutate(obj).write();
    }, ERROR_CLONE);
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(people);
    ctx.revoke();
    assert.throws(() => {
      ctx.write();
    }, ERROR_REVOKED);
  });
});

test('get', (t) => {
  t.test('returns `this` if no arguments are passed', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.get(), ctx);
  });

  t.test('works with one prop', (t) => {
    assert.equal(mutate(alice).get('birth_date').read(), alice.birth_date);
  });

  t.test('works with two props', (t) => {
    assert.equal(mutate(alice).get('birth_date', 'year').read(), alice.birth_date.year);
  });

  t.test('chains with other get calls', (t) => {
    assert.equal(mutate(alice).get('birth_date').get('year').read(), alice.birth_date.year);
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.get('birth_date');
    }, ERROR_REVOKED);
  });
});

test('set', (t) => {
  t.test('works directly on the root (one argument)', (t) => {
    let copy = mutate(alice)
      .set({...alice, birth_date: {...alice.birth_date, year: 1988}})
      .final();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
    copy = mutate(alice)
      .set(alice)
      .set('birth_date', 'year', 1999)
      .final();
    assert.equal(copy.birth_date.year, 1999);
    assert.equal(copy.death_date, aliceDeathDate);

    // This should revert `birth_date.year` change.
    copy = mutate(alice)
      .set('birth_date', 'year', 1999)
      .set(alice)
      .final();
    assert.equal(copy.birth_date, aliceBirthDate);
    assert.equal(copy.death_date, aliceDeathDate);

    // This should preserve the `birth_date.year` change.
    copy = mutate(alice)
      .set('birth_date', 'year', 1999)
      .set(alice)
      .set('birth_date', 'year', 1999)
      .final();
    assert.equal(copy.birth_date.year, 1999);
    assert.equal(copy.death_date, aliceDeathDate);

    // This should also preserve the `birth_date.year` change.
    const ctx = mutate(alice);
    const birthYearCtx = ctx.get('birth_date', 'year');
    ctx
      .set('birth_date', 'year', 1999)
      .set(alice);
    birthYearCtx.set(1999);
    copy = ctx.final();
    assert.equal(copy.birth_date.year, 1999);
    assert.equal(copy.death_date, aliceDeathDate);

    // This should also preserve the `birth_date.year` change.
    const ctx2 = mutate(people);
    const birthYearCtx2 = ctx2.get(0, 'birth_date', 'year');
    birthYearCtx2.set(1988);
    ctx2.set(people);
    birthYearCtx2.set(1999);
    const peopleCopy = ctx2.final();
    assert.equal(peopleCopy[0].birth_date.year, 1999);
    assert.equal(peopleCopy[0].death_date, aliceDeathDate);
  });

  t.test('works directly on the root (one argument, primitives)', (t) => {
    assert.equal(mutate/*:: <null | 7> */(null).set(7).final(), 7);
    assert.equal(mutate/*:: <void | 7> */(undefined).set(7).final(), 7);
    assert.equal(mutate/*:: <true | 7> */(true).set(7).final(), 7);
    assert.equal(mutate/*:: <false | 7> */(false).set(7).final(), 7);
    assert.equal(mutate/*:: <3 | 7> */(3).set(7).final(), 7);
    assert.equal(mutate/*:: <bigint | 7> */(BigInt('3')).set(7).final(), 7);
    assert.equal(mutate/*:: <'3' | 7> */('3').set(7).final(), 7);
    assert.equal(mutate/*:: <symbol | 7> */(Symbol('3')).set(7).final(), 7);
  });

  t.test('works directly on a child (one argument)', (t) => {
    let copy = mutate(alice)
      .get('birth_date')
      .set({...alice.birth_date, year: 1988})
      .finalRoot();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
    copy = mutate(alice)
      .get('birth_date', 'year')
      .set(1999)
      .finalRoot();
    assert.equal(copy.birth_date.year, 1999);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('works with one prop', (t) => {
    const copy = mutate(alice)
      .get('birth_date')
      .set('year', 1988)
      .finalRoot();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('works with two props', (t) => {
    const copy = mutate(alice)
      .set('birth_date', 'year', 1988)
      .final();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('chains with other set calls', (t) => {
    let copy = mutate(alice)
      .set('birth_date', 'year', 1988)
      .set('death_date', 'year', 2088)
      .final();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date.year, 2088);
    copy = mutate(alice)
      .get('birth_date')
      .set('year', 1990)
      .set('month', 10)
      .set('day', 21)
      .parent()
      .get('death_date')
      .set('year', 2090)
      .set('month', 11)
      .set('day', 30)
      .parent()
      .final();
    assert.deepEqual(
      copy.birth_date,
      {year: 1990, month: 10, day: 21},
    );
    assert.deepEqual(
      copy.death_date,
      {year: 2090, month: 11, day: 30},
    );
  });

  t.test('returns the same object if no changes are made', (t) => {
    const copy1 = mutate(alice)
      .set('name', alice.name)
      .set('birth_date', alice.birth_date)
      .set('death_date', alice.death_date)
      .set('birth_date', 'year', alice.birth_date.year)
      .set('death_date', 'year', alice.death_date.year)
      .final();
    assert.equal(alice, copy1);
    const copy2 = mutate(people)
      .set(0, people[0])
      .set(0, 'name', people[0].name)
      .set(0, 'birth_date', people[0].birth_date)
      .set(0, 'death_date', people[0].death_date)
      .set(0, 'birth_date', 'year', people[0].birth_date.year)
      .set(0, 'death_date', 'year', people[0].death_date.year)
      .final();
    assert.equal(people, copy2);
  });

  t.test('clones the object only once', (t) => {
    const ctx = mutate(alice);
    ctx.get('birth_date').set('year', 1987);
    const newBirthDate1 = ctx.read().birth_date;
    ctx.get('birth_date').set('year', 1988);
    const newBirthDate2 = ctx.read().birth_date;
    assert.equal(newBirthDate1, newBirthDate2);
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.set('birth_date', alice.birth_date);
    }, ERROR_REVOKED);
    assert.throws(() => {
      ctx.set(alice);
    }, ERROR_REVOKED);
  });

  t.test('throws if called on a function', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('func').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws if called on a number object', (t) => {
    const ctx = mutate(unsupportedProperties);
    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('numberObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('can set number objects directly', (t) => {
    const copy = mutate(unsupportedProperties)
      .set('numberObject', new Number(2))
      .final();
    assert.equal(+copy.numberObject, 2);
  });

  t.test('throws if called on a string object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('stringObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('can set string objects directly', (t) => {
    const copy = mutate(unsupportedProperties)
      .set('stringObject', new String('huh'))
      .final();
    assert.equal(String(copy.stringObject), 'huh');
  });

  t.test('throws if called on a Date object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('dateObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws if called on a TypedArray object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('typedArrayObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws if called on a RegExp object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('regExpObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws if called on a Map object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('mapObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws if called on a Set object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      ctx.get('setObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws on class instances', (t) => {
    class NiceClass {
      /*::
      value: string;
      */
      constructor() {
        this.value = 'nice';
      }
    }
    assert.throws(() => {
      mutate(new NiceClass()).set('value', 'naughty');
    }, ERROR_CLONE);
  });

  t.test('can set the length on arrays', (t) => {
    assert.deepEqual(
      // $FlowExpectedError[incompatible-type]
      mutate([1, 2, 3]).set('length', 1).final(),
      [1],
    );
  });

  t.test('can add custom properties to arrays', (t) => {
    const copy = mutate(people)
      // $FlowExpectedError[incompatible-type]
      .set('customProp', 10)
      .final();
    assert.equal(copy.customProp, 10);
  });

  t.test('works on cyclic references', (t) => {
    /*::
    type Cyclic = {x: Cyclic | null}
    */
    const orig/*: Cyclic */ = {x: null};
    orig.x = orig;
    Object.freeze(orig);
    const copy1 = mutate(orig)
      .get('x')
      .set('x', null)
      .parent()
      .final();
    assert.equal((copy1.x?.x), null);
    const copy2 = mutate(orig)
      .set('x', 'x', 'x', null)
      .final();
    assert.equal((copy2.x?.x?.x), null);
  });

  t.test('propagates changes to parent contexts', (t) => {
    const ctx = mutate/*:: <ReadOnlyPerson> */(alice);
    const birthDateContext1 = ctx.get('birth_date');
    const yearContext1 = birthDateContext1.get('year');

    birthDateContext1.set('year', 1988);
    // Should propagate to birthDateContext1 and yearContext1
    ctx.set('birth_date', {year: 2008});

    assert.equal(ctx.get('birth_date').read().year, 2008);
    assert.equal(birthDateContext1.read().year, 2008);
    assert.equal(yearContext1.read(), 2008);
  });

  t.test('works on shared references', (t) => {
    const shared/*: {readonly foo: string} */ = Object.freeze({foo: ''});
    const object/*: {
      readonly prop1: typeof shared,
      readonly prop2: typeof shared,
    } */ = Object.freeze({
      prop1: shared,
      prop2: shared,
    });
    const copy = mutate(object)
      .set('prop1', 'foo', 'abc')
      .set('prop2', 'foo', '123')
      .final();
    assert.equal(copy.prop1.foo, 'abc');
    assert.equal(copy.prop2.foo, '123');
  });

  t.test('works on externally-frozen objects', (t) => {
    const source/*: {readonly ref: {readonly name: string} | null} */ =
      Object.freeze({ref: null});
    const frozenRef = Object.freeze({name: ''});
    const copy = mutate(source)
      .set('ref', frozenRef)
      .set('ref', 'name', 'hi')
      .final();
    assert.equal(copy.ref?.name, 'hi');
  });

  t.test('works on symbol keys', (t) => {
    const rootCtx = mutate({[SYMBOL_KEY]: 1999, otherProp: 2000});
    rootCtx.set('otherProp', 2001);
    const symbolCtx = rootCtx.get(SYMBOL_KEY);
    assert.equal(symbolCtx.read(), 1999);
    symbolCtx.set(2000);
    assert.equal(symbolCtx.read(), 2000);
    assert.deepEqual(rootCtx.final(), {[SYMBOL_KEY]: 2000, otherProp: 2001});
  });

  t.test('works on arrays from another realm', (t) => {
    const foreignArray = vm.runInNewContext('[1, 2, 3]');
    const copy = mutate(foreignArray).set(0, 9).final();
    assert.deepEqual([...copy], [9, 2, 3]);
  });

  t.test('throws on arrays with a detached prototype', (t) => {
    const array = [1, 2, 3];
    Object.setPrototypeOf(array, null);
    assert.throws(() => {
      mutate(array).set(0, 9);
    }, ERROR_CLONE);
  });

  t.test('throws on non-arrays inheriting from Array.prototype', (t) => {
    const object = Object.create(Array.prototype);
    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate(object).set('bar', 2);
    }, ERROR_CLONE);
  });

  t.test('throws on array subclasses claiming a native constructor', (t) => {
    class SubArray extends Array/*:: <number> */ {}
    // $FlowFixMe[cannot-write]
    SubArray.prototype.constructor = Array;
    const array = new SubArray();
    array.push(1, 2, 3);

    assert.throws(() => {
      mutate(array).set(0, 9);
    }, ERROR_CLONE);
  });

  t.test('throws on custom prototypes claiming a native constructor', (t) => {
    const proto = Object.create(null);
    proto.constructor = Object;
    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate(Object.create(proto)).set('a', 'value');
    }, ERROR_CLONE);
  });

  t.test('throws on array subclasses', (t) => {
    class SubArray extends Array/*:: <number> */ {}
    const array = new SubArray();
    array.push(1, 2, 3);

    assert.throws(() => {
      mutate(array).set(0, 9);
    }, ERROR_CLONE);
  });

  t.test('can set a non-existent property to undefined', (t) => {
    assert.deepEqual(
      mutate/*:: <{readonly a?: void}> */({})
        .set('a', undefined)
        .final(),
      {a: undefined},
    );
  });

  t.test('works when the parent context has removed our source properties', (t) => {
    const rootCtx = mutate({a: {b: {c: 1}}, unrelated: 10});
    const nestedCtx = rootCtx.get('a', 'b');

    // $FlowExpectedError[incompatible-type]
    rootCtx.set('a', {completely: 'different'});
    // $FlowExpectedError[incompatible-type]
    nestedCtx.set('d', 2);

    assert.deepEqual(rootCtx.final(), {
      a: {
        b: {d: 2},
        completely: 'different',
      },
      unrelated: 10,
    });
  });

  t.test('creates paths that do not exist', (t) => {
    const copy = mutate({})
      // $FlowExpectedError[incompatible-type]
      .set('a', 'b', 'c', 'value')
      .final();
    assert.deepEqual(copy, {a: {b: {c: 'value'}}});
  });

  t.test('overwrites primitive properties to create new paths', (t) => {
    const copy = mutate({a: null, b: 1})
      // $FlowExpectedError[incompatible-type]
      .set('a', 'b', 'v1')
      // $FlowExpectedError[incompatible-type]
      .set('b', 'c', 'v2')
      .final();
    assert.deepEqual(copy, {a: {b: 'v1'}, b: {c: 'v2'}});
  });

  t.test('throws on objects with a custom prototype', (t) => {
    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate(Object.create({inherited: 1})).set('a', 'value');
    }, ERROR_CLONE);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate(Object.create({constructor: null})).set('a', 'value');
    }, ERROR_CLONE);
  });

  t.test('shadows inherited properties without modifying the prototype', (t) => {
    const copy = mutate({a: 1})
      // $FlowExpectedError[incompatible-type]
      .set('toString', 'replaced')
      .final();
    assert.equal(Object.hasOwn(copy, 'toString'), true);
    assert.equal(Reflect.get(copy, 'toString'), 'replaced');
    assert.equal(({}).toString(), '[object Object]');
  });

  t.test('defines __proto__ as an own property', (t) => {
    const newProto = {p: 1};
    const copy = mutate({a: 1})
      // $FlowExpectedError[incompatible-type]
      .set('__proto__', newProto)
      .final();
    assert.equal(Object.hasOwn(copy, '__proto__'), true);
    assert.equal(Reflect.get(copy, '__proto__'), newProto);
    assert.equal(Object.getPrototypeOf(copy), Object.prototype);
    // $FlowExpectedError[prop-missing]
    assert.equal(copy.p, undefined);
  });
});

test('merge', (t) => {
  t.test('sets each own enumerable key/value pair', (t) => {
    const copy = mutate(alice)
      .merge({name: 'Bob', birth_date: {year: 1988}})
      .final();
    assert.equal(copy.name, 'Bob');
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('recurses into nested plain objects', (t) => {
    const source/*: {
      readonly a: {readonly b: {readonly c: number, readonly d: number}},
    } */ = Object.freeze({
      a: Object.freeze({b: Object.freeze({c: 1, d: 2})}),
    });
    const copy = mutate(source)
      .merge({a: {b: {c: 3}}})
      .final();
    assert.deepEqual(copy, {a: {b: {c: 3, d: 2}}});
  });

  t.test('replaces arrays, class instances, and primitives directly', (t) => {
    class Point {
      /*:: readonly x: number; */
      constructor(x/*: number */) {
        this.x = x;
      }
    }
    const newArray = [4, 5];
    const newPoint = new Point(2);
    const source/*: {
      readonly array: ReadonlyArray<number>,
      readonly point: Point,
      readonly primitive: number,
    } */ = Object.freeze({
      array: Object.freeze([1, 2, 3]),
      point: new Point(1),
      primitive: 1,
    });
    const copy = mutate(source)
      .merge({array: newArray, point: newPoint, primitive: 2})
      .final();
    assert.equal(copy.array, newArray);
    assert.equal(copy.point, newPoint);
    assert.equal(copy.primitive, 2);
  });

  t.test('returns the same object if no changes are made', (t) => {
    const copy = mutate(alice)
      .merge({
        name: alice.name,
        birth_date: {year: alice.birth_date.year},
        death_date: alice.death_date,
      })
      .final();
    assert.equal(copy, alice);
  });

  t.test('makes no changes when passed an empty object', (t) => {
    assert.equal(mutate(alice).merge({}).final(), alice);
  });

  t.test('returns the context for chaining', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.merge({name: 'Bob'}), ctx);
  });

  t.test('works on child contexts', (t) => {
    const copy = mutate(alice)
      .get('birth_date')
      .merge({year: 1988, month: 10})
      .finalRoot();
    assert.deepEqual(copy.birth_date, {year: 1988, month: 10});
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('works on symbol keys', (t) => {
    const rootCtx = mutate({[SYMBOL_KEY]: 1999, otherProp: 2000});
    rootCtx.merge({[SYMBOL_KEY]: 2000, otherProp: 2001});
    assert.deepEqual(rootCtx.final(), {[SYMBOL_KEY]: 2000, otherProp: 2001});
  });

  t.test('ignores non-enumerable own properties', (t) => {
    const object/*: {visible: number, hidden?: number} */ = {visible: 1};
    Object.defineProperty(object, 'hidden', {
      value: 2,
      enumerable: false,
    });
    assert.deepEqual(
      mutate/*:: <{readonly visible?: number, readonly hidden?: number}> */({})
        .merge(object)
        .final(),
      {visible: 1},
    );
  });

  t.test('never patches values inherited from the prototype chain', (t) => {
    const copy = mutate({a: 1})
      // $FlowExpectedError[incompatible-type]
      .merge({toString: {x: 1}, constructor: {y: 2}})
      .final();
    assert.equal(Object.hasOwn(copy, 'toString'), true);
    assert.equal(Object.hasOwn(copy, 'constructor'), true);
    assert.deepEqual(Reflect.get(copy, 'toString'), {x: 1});
    assert.deepEqual(Reflect.get(copy, 'constructor'), {y: 2});
    assert.equal(({}).toString(), '[object Object]');
  });

  t.test('makes no changes for an empty patch under an inherited name', (t) => {
    const source = {a: 1};
    const copy = mutate(source)
      // $FlowExpectedError[incompatible-type]
      .merge({toString: {}})
      .final();
    assert.equal(copy, source);
  });

  t.test('discards a child context holding an inherited value', (t) => {
    const context = mutate({a: 1});
    // $FlowExpectedError[incompatible-type]
    assert.equal(typeof context.get('toString').read(), 'function');
    // $FlowExpectedError[incompatible-type]
    const copy = context.merge({toString: {x: 1}}).final();
    assert.deepEqual(Reflect.get(copy, 'toString'), {x: 1});
  });

  t.test('defines __proto__ as an own property', (t) => {
    const copy = mutate({a: 1})
      .merge(JSON.parse('{"__proto__": {"polluted": true}}'))
      .final();
    assert.equal(Object.hasOwn(copy, '__proto__'), true);
    assert.deepEqual(Reflect.get(copy, '__proto__'), {polluted: true});
    assert.equal(Object.getPrototypeOf(copy), Object.prototype);
    // $FlowExpectedError[prop-missing]
    assert.equal(copy.polluted, undefined);
    assert.equal(Reflect.get({}, 'polluted'), undefined);

    const copy2 = mutate({a: 1})
      .merge(JSON.parse('{"__proto__": 1}'))
      .final();
    assert.equal(Object.hasOwn(copy2, '__proto__'), true);
    assert.equal(Reflect.get(copy2, '__proto__'), 1);
    assert.equal(Object.getPrototypeOf(copy2), Object.prototype);
  });

  t.test('overwrites an existing own __proto__ property', (t) => {
    const copy = mutate(JSON.parse('{"__proto__": 1}'))
      .merge(JSON.parse('{"__proto__": 2}'))
      .final();
    assert.equal(Object.hasOwn(copy, '__proto__'), true);
    assert.equal(Reflect.get(copy, '__proto__'), 2);
    assert.equal(Object.getPrototypeOf(copy), Object.prototype);
  });

  t.test('throws when patching an object that cannot be cloned', (t) => {
    const map/*: Map<string, number> */ = new Map();
    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate({map}).merge({map: {size: 0}});
    }, ERROR_CLONE);
  });

  t.test('creates paths that do not exist', (t) => {
    const copy = mutate({})
      // $FlowExpectedError[incompatible-type]
      .merge({a: {b: {c: 'value'}}})
      .final();
    assert.deepEqual(copy, {a: {b: {c: 'value'}}});
  });

  t.test('overwrites primitive properties to create new paths', (t) => {
    const copy = mutate({a: null, b: 1})
      // $FlowExpectedError[incompatible-type]
      .merge({a: {b: 'v1'}, b: {c: 'v2'}})
      .final();
    assert.deepEqual(copy, {a: {b: 'v1'}, b: {c: 'v2'}});
  });

  t.test('recurses into objects with a null prototype', (t) => {
    const nullProtoValue = {__proto__: null, year: 1988};
    // $FlowExpectedError[incompatible-type]
    const copy = mutate(alice).merge({birth_date: nullProtoValue}).final();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(Object.getPrototypeOf(copy.birth_date), Object.prototype);
  });

  t.test('recurses into plain objects from another realm', (t) => {
    const foreignObject = vm.runInNewContext('({year: 1988})');
    const copy = mutate(alice).merge({birth_date: foreignObject}).final();
    assert.deepEqual(copy.birth_date, {year: 1988});
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('replaces objects with a detached prototype chain', (t) => {
    class Detached {
      /*:: readonly year: number; */
      constructor() {
        this.year = 1988;
      }
    }
    Object.setPrototypeOf(Detached.prototype, null);

    const fakeObjectProto = Object.create(null);
    // $FlowExpectedError[prop-missing]
    fakeObjectProto.constructor = function Object() {};

    const values = [
      Object.create(Object.create(null)),
      new Detached(),
      Object.create(fakeObjectProto),
    ];
    for (const value of values) {
      // $FlowExpectedError[incompatible-type]
      const copy = mutate(alice).merge({birth_date: value}).final();
      // These should be assigned as-is rather than merged into `birth_date`.
      assert.equal(copy.birth_date, value);
    }
  });

  t.test('invalidates existing child contexts', (t) => {
    const rootCtx = mutate({a: {b: {c: 1}}, unrelated: 10});
    const nestedCtx = rootCtx.get('a', 'b');

    // $FlowExpectedError[incompatible-call]
    rootCtx.merge({a: {b: {c: 2}}});
    assert.equal(nestedCtx.read().c, 2);

    nestedCtx.set('c', 3);
    assert.deepEqual(rootCtx.final(), {a: {b: {c: 3}}, unrelated: 10});
  });

  t.test('throws if not passed a plain object', (t) => {
    for (const value of [null, undefined, 1, 'a', [1], new Date()]) {
      assert.throws(() => {
        // $FlowExpectedError[incompatible-type]
        // $FlowExpectedError[incompatible-exact]
        mutate(alice).merge(value);
      }, /^Error: `merge` must be called with a plain object\.$/);
    }
  });

  t.test('throws if the target is an array', (t) => {
    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate([1, 2, 3]).merge({0: 9});
    }, /^Error: `merge` cannot be used to patch an array\.$/);

    assert.throws(() => {
      // $FlowExpectedError[incompatible-type]
      mutate({a: [1, 2, 3]}).merge({a: {0: 9}});
    }, /^Error: `merge` cannot be used to patch an array\.$/);

    // Replacing an array wholesale is still allowed.
    const newArray = [4, 5, 6];
    assert.equal(
      mutate({a: [1, 2, 3]}).merge({a: newArray}).final().a,
      newArray,
    );
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.merge({name: 'Bob'});
    }, ERROR_REVOKED);
  });
});

test('update', (t) => {
  t.test('works directly on the root (one argument)', (t) => {
    const ctx = mutate(alice);
    ctx.update((ctx2) => {
      assert.equal(ctx, ctx2);
      ctx2.set('birth_date', 'year', 1988);
    });
    const copy = ctx.final();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('works directly on a child (one argument)', (t) => {
    const ctx = mutate(alice).get('birth_date');
    ctx.update((ctx2) => {
      assert.equal(ctx, ctx2);
      ctx2.set('year', 1988);
    });
    const copy = ctx.finalRoot();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('works with one prop', (t) => {
    const ctx = mutate(alice);
    ctx.update('birth_date', (ctx2) => {
      assert.equal(ctx.get('birth_date'), ctx2);
      ctx2.set('year', 1988);
    });
    const copy = ctx.finalRoot();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('works with two props', (t) => {
    const ctx = mutate(alice);
    ctx.update('birth_date', 'year', (ctx2) => {
      assert.equal(ctx.get('birth_date', 'year'), ctx2);
      ctx2.set(1988);
    });
    const copy = ctx.finalRoot();
    assert.equal(copy.birth_date.year, 1988);
    assert.equal(copy.death_date, aliceDeathDate);
  });

  t.test('chains with other update calls', (t) => {
    let copy = mutate(alice)
      .update('birth_date', 'year', (ctx) => { ctx.set(1988); })
      .update('death_date', 'year', (ctx) => { ctx.set(2088); })
      .final();
  });

  t.test('returns the same object if no changes are made', (t) => {
    const copy = mutate(alice).update((ctx) => {
      // no-op
    }).final();
    assert.equal(copy, alice);
  });
});

test('dangerouslySetAsMutable', (t) => {
  t.test('updates parent and child contexts', (t) => {
    const ctx = mutate(alice);
    const birthDateCtx = ctx.get('birth_date');
    const birthYearCtx = birthDateCtx.get('year');

    birthYearCtx.set(1988);
    assert.equal(birthYearCtx.read(), 1988);

    const mutableBirthDate = {year: 2000};
    birthDateCtx.set(mutableBirthDate);
    birthDateCtx.dangerouslySetAsMutable();
    assert.equal(birthYearCtx.read(), 2000);
    assert.equal(birthYearCtx.read(), 2000);

    birthDateCtx.set('year', 1979);
    assert.equal(birthYearCtx.read(), 1979);
    assert.equal(ctx.read().birth_date.year, 1979);
    assert.equal(mutableBirthDate.year, 1979);

    ctx.set('birth_date', 'year', 1966);
    assert.equal(birthYearCtx.read(), 1966);
    assert.equal(birthDateCtx.read().year, 1966);
    assert.equal(mutableBirthDate.year, 1966);

    assert.deepEqual(
      ctx.final(),
      {...alice, birth_date: mutableBirthDate},
    );
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.dangerouslySetAsMutable();
    }, ERROR_REVOKED);
  });
});

test('parent', (t) => {
  t.test('returns null on the root', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.parent(), null);
    ctx.revoke();
  });

  t.test('returns the parent of a child context', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.get('birth_date').parent(), ctx);
    ctx.revoke();
  });

  t.test('returns the parent of a grandchild context', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.get('birth_date', 'year').parent(), ctx.get('birth_date'));
    ctx.revoke();
  });
});

test('root', (t) => {
  t.test('returns the root on the root', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.root(), ctx);
    ctx.revoke();
  });

  t.test('returns the root of a child context', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.get('birth_date').root(), ctx);
    ctx.revoke();
  });

  t.test('returns the root of a grandchild context', (t) => {
    const ctx = mutate(alice);
    assert.equal(ctx.get('birth_date', 'year').root(), ctx);
    ctx.revoke();
  });
});

test('revoke', (t) => {
  t.test('can revoke the root context', (t) => {
    const ctx = mutate/*:: <ReadOnlyPerson> */(alice);
    const birthDateContext = ctx.get('birth_date');
    const birthDateYearContext = birthDateContext.get('year');
    const deathDateContext = ctx.get('death_date');
    const deathDateYearContext = deathDateContext.get('year');

    ctx.revoke();
    // Can call revoke twice.
    ctx.revoke();

    assert.ok(ctx.isRevoked());

    t.test('revoking the root context revokes all child contexts', (t) => {
      assert.ok(birthDateContext.isRevoked());
      assert.ok(birthDateYearContext.isRevoked());
      assert.ok(deathDateContext.isRevoked());
      assert.ok(deathDateYearContext.isRevoked());
    });

    t.test('attempting to use a revoked context throws', (t) => {
      assert.throws(() => {
        ctx.set('birth_date', alice.birth_date);
      }, ERROR_REVOKED);
    });
  });
});

test('final', (t) => {
  t.test('can be called on child contexts without affecting parent', (t) => {
    const root = Object.freeze({
      foo: Object.freeze({bar: '' /*:: as string */}),
    });
    const rootCtx = mutate(root);
    const fooCtx = rootCtx.get('foo');
    const fooCopy = fooCtx.set('bar', 'a').final();

    assert.equal(fooCopy.bar, 'a');

    const rootCopy = rootCtx
      .set('foo', 'bar', 'b')
      .final();

    assert.equal(rootCopy.foo.bar, 'b');
  });

  t.test('discards copies made before a child was replaced', (t) => {
    const root = Object.freeze({
      foo: Object.freeze({bar: '' /*:: as string */}),
    });

    const rootCtx = mutate(root);
    rootCtx.get('foo').set('bar', 'a');
    const tmpFoo = rootCtx.get('foo').write();

    rootCtx.set('foo', Object.freeze({bar: 'b'}));
    rootCtx.get('foo').set('bar', 'c');

    const rootCopy = rootCtx.finalRoot();
    assert.equal(rootCopy.foo.bar, 'c');

    // `tmpFoo` is stale
    assert.equal(tmpFoo.bar, 'a');
  });

  t.test('copies objects with a null prototype onto Object.prototype', (t) => {
    const orig/*: {
      __proto__: null,
      readonly value: {__proto__: null, readonly number: number},
    } */ = Object.create(null, {
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

    const copy = mutate(orig)
      .get('value')
      .set('number', 2)
      .parent()
      .final();

    assert.equal(orig.value.number, 1);
    assert.equal(Object.getPrototypeOf(orig), null);
    assert.equal(copy.value.number, 2);
    assert.equal(Object.getPrototypeOf(copy), Object.prototype);
    assert.equal(Object.getPrototypeOf(copy.value), Object.prototype);
  });
});

//Regression test for covariant `T` on `CowContext`

/*::
declare const personContext: types.CowContext<ReadOnlyPerson, null>;
declare const personRoot: types.CowRootContext<ReadOnlyPerson>;

personContext as types.CowContext<ReadOnlyPerson | null, null>;
personRoot as types.CowRootContext<ReadOnlyPerson | null>;

declare const maybePersonContext: types.CowContext<ReadOnlyPerson | null, null>;
// $FlowExpectedError[incompatible-type]
maybePersonContext as types.CowContext<ReadOnlyPerson, null>;
*/
