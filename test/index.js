/*
 * @flow strict
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

// $FlowIssue[cannot-resolve-module]
import assert from 'node:assert/strict';
// $FlowIssue[cannot-resolve-module]
import test from 'node:test';

import mutate from '../src/index.js';

/*:: import * as types from '../src/index.js'; */

const ERROR_REVOKED =
  /^Error: This context has been revoked and can no longer be used\.$/;

const ERROR_CLONE =
  /^Error: Only plain objects, arrays, and class instances can be cloned\./;

// $FlowIgnore[incompatible-cast]
const SYMBOL_KEY = Symbol()/*:: as 'symbol' */;

/*::
type DatePeriod = {
  year: number,
};

type ReadOnlyDatePeriod = {
  +year: number,
  +month?: number,
  +day?: number,
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
  +func: () => string,
  +numberObject: Number,
  +stringObject: String,
  +dateObject: Date,
  +typedArrayObject: Int8Array,
  +regExpObject: RegExp,
  +mapObject: Map<empty, empty>,
  +setObject: Set<empty>,
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
    // $FlowIgnore[cannot-write]
    ctx.read().birth_date.year = 1988;
    const copy = ctx.final();
    assert.equal(copy.birth_date.year, 1988);
  });

  t.test('throws if you pass a derived built-in', (t) => {
    class FunDate extends Date {}
    assert.throws(() => {
      mutate(new FunDate()).write();
    }, /FunDate objects are not supported/);
  });

  t.test('throws if you pass a generator', (t) => {
    function* makeGenerator() {
      yield 1;
    }
    assert.throws(() => {
      mutate(makeGenerator()).write();
    }, /\[object GeneratorFunction\] objects are not supported/);
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
      // $FlowIgnore[incompatible-call]
      ctx.get('func').set('error', null);
    }, /Function objects are not supported/);
  });

  t.test('throws if called on a number object', (t) => {
    const ctx = mutate(unsupportedProperties);
    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('numberObject').set('error', null);
    }, /Number objects are not supported/);
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
      // $FlowIgnore[incompatible-call]
      ctx.get('stringObject').set('error', null);
    }, /String objects are not supported/);
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
      // $FlowIgnore[incompatible-call]
      ctx.get('dateObject').set('error', null);
    }, /Date objects are not supported/);
  });

  t.test('throws if called on a TypedArray object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('typedArrayObject').set('error', null);
    }, /Int8Array objects are not supported/);
  });

  t.test('throws if called on a RegExp object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('regExpObject').set('error', null);
    }, /RegExp objects are not supported/);
  });

  t.test('throws if called on a Map object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('mapObject').set('error', null);
    }, /Map objects are not supported/);
  });

  t.test('throws if called on a Set object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('setObject').set('error', null);
    }, /Set objects are not supported/);
  });

  t.test('works on class instances (strict mode)', (t) => {
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
    const orig = new NiceClass();
    const copy = mutate(orig, /* strict = */ true)
      .set('value', 'naughty')
      .final();
    assert.ok(copy instanceof NiceClass);
    assert.ok(copy instanceof NiceBase);
    assert.equal(copy.value, 'naughty');
    assert.equal(orig.value, 'nice');
  });

  t.test('can set the length on arrays', (t) => {
    assert.deepEqual(
      // $FlowIgnore[incompatible-call]
      mutate([1, 2, 3]).set('length', 1).final(),
      [1],
    );
  });

  t.test('can add custom properties to arrays', (t) => {
    const copy = mutate(people)
      // $FlowIgnore[incompatible-call]
      .set('customProp', 10)
      .final();
    // $FlowIgnore[prop-missing]
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
      // $FlowIgnore[incompatible-call]
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
    const shared/*: {+foo: string} */ = Object.freeze({foo: ''});
    const object/*: {
      +prop1: typeof shared,
      +prop2: typeof shared,
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
    const source/*: {+ref: {+name: string} | null} */ =
      Object.freeze({ref: null});
    const frozenRef = Object.freeze({name: ''});
    const copy = mutate(source)
      .set('ref', frozenRef)
      // $FlowIgnore[incompatible-call]
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

  t.test('works on array subclasses (strict mode)', (t) => {
    class SubArray extends Array/*:: <number> */ {
      /*:: +prop: string; */
      constructor(prop/*: string */) {
        super();
        this.prop = prop;
      }
    }
    const array = new SubArray('value');
    array.push(1, 2, 3);

    const newArray = mutate(array, /* strict = */ true).update(ctx => {
      ctx.write().push(4, 5, 6);
    }).final();

    assert.ok(newArray instanceof SubArray);
    assert.equal(newArray.prop, 'value');
    assert.deepEqual([...newArray], [1, 2, 3, 4, 5, 6]);
  });

  t.test('can set a non-existent property to undefined', (t) => {
    assert.deepEqual(
      mutate/*:: <{+a?: void}> */({})
        .set('a', undefined)
        .final(),
      {a: undefined},
    );
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

  t.test('preserves frozenness of objects (strict mode)', (t) => {
    const copy = mutate(alice, /* strict = */ true)
      .set('birth_date', 'year', 2000)
      .set('death_date', 'year', 3000)
      .final();
    assert.ok(Object.isFrozen(copy));
    assert.ok(Object.isFrozen(copy.birth_date));
    assert.ok(Object.isFrozen(copy.death_date));
  });

  t.test('preserves frozenness of arrays (strict mode)', (t) => {
    const copy = mutate(people, /* strict = */ true)
      .set(0, 'birth_date', 'year', 1988)
      .update((ctx) => {
        ctx.write().push(alice);
      })
      .final();
    assert.equal(copy[0].birth_date.year, 1988);
    assert.equal(copy[1], alice);
    assert.ok(Object.isFrozen(copy));
    assert.ok(Object.isFrozen(copy[0]));
    assert.ok(Object.isFrozen(copy[0].birth_date));
    assert.ok(Object.isFrozen(copy[0].death_date));
  });

  t.test('preserves sealedness of objects (strict mode)', (t) => {
    const orig/*: {+name: string, +address?: string} */ =
      Object.seal({name: ''});
    const copy = mutate(orig, /* strict = */ true)
      .set('address', 'abc')
      .final();
    assert.ok(Object.isSealed(copy));
    assert.ok(!Object.isFrozen(copy));
  });

  t.test('preserves extensibility of objects (strict mode)', (t) => {
    const orig/*: {+name: string, +address?: string} */ =
      Object.preventExtensions({name: ''});
    const copy = mutate(orig, /* strict = */ true)
      .set('address', 'abc')
      .final();
    assert.ok(!Object.isExtensible(copy));
    assert.ok(!Object.isSealed(copy));
    assert.ok(!Object.isFrozen(copy));
  });

  t.test('preserves descriptors for individual properties (strict mode)', (t) => {
    const orig = {};

    const origDescriptors = {
      a: {configurable: false, enumerable: false, writable: false, value: undefined},
      b: {configurable: false, enumerable: false, writable: true, value: undefined},
      c: {configurable: false, enumerable: true, writable: false, value: undefined},
      d: {configurable: false, enumerable: true, writable: true, value: undefined},
      e: {configurable: true, enumerable: false, writable: false, value: undefined},
      f: {configurable: true, enumerable: false, writable: true, value: undefined},
      g: {configurable: true, enumerable: true, writable: false, value: undefined},
      h: {configurable: true, enumerable: true, writable: true, value: undefined},
    };

    // $FlowIgnore[prop-missing]
    Object.defineProperties(orig, origDescriptors);
    // $FlowIgnore[incompatible-call]
    const copy = mutate(orig, /* strict = */ true).set('a', '1').final();
    const copyDescriptors = Object.getOwnPropertyDescriptors(copy);
    assert.deepEqual(copyDescriptors.a, {...origDescriptors.a, value: '1'});
    assert.deepEqual(copyDescriptors.b, origDescriptors.b);
    assert.deepEqual(copyDescriptors.c, origDescriptors.c);
    assert.deepEqual(copyDescriptors.d, origDescriptors.d);
    assert.deepEqual(copyDescriptors.e, origDescriptors.e);
    assert.deepEqual(copyDescriptors.f, origDescriptors.f);
    assert.deepEqual(copyDescriptors.g, origDescriptors.g);
    assert.deepEqual(copyDescriptors.h, origDescriptors.h);
  });

  t.test('does not restore descriptors onto stale copies (strict mode)', (t) => {
    const root = Object.freeze({
      foo: Object.freeze({bar: '' /*:: as string */}),
    });

    const rootCtx = mutate(root, /* strict = */ true);
    rootCtx.get('foo').set('bar', 'a');
    const tmpFoo = rootCtx.get('foo').write();

    assert.ok(!Object.isFrozen(tmpFoo));

    rootCtx.set('foo', Object.freeze({bar: 'b'}));
    rootCtx.get('foo').set('bar', 'c');

    const rootCopy = rootCtx.finalRoot();
    assert.ok(Object.isFrozen(rootCopy));
    assert.ok(Object.isFrozen(rootCopy.foo));
    assert.equal(rootCopy.foo.bar, 'c');

    // `tmpFoo` is stale
    assert.ok(!Object.isFrozen(tmpFoo));
    assert.equal(tmpFoo.bar, 'a');
  });

  t.test('preserves null prototypes (strict mode)', (t) => {
    const orig/*: {
      __proto__: null,
      +value: {__proto__: null, +number: number},
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

    const copy = mutate(orig, /* strict = */ true)
      .get('value')
      .set('number', 2)
      .parent()
      .final();

    assert.equal(orig.value.number, 1);
    assert.equal(copy.value.number, 2);
    assert.equal(Object.getPrototypeOf(copy), null);
    assert.equal(Object.getPrototypeOf(copy.value), null);
  });
});
