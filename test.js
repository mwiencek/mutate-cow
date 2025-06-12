/*
 * @flow strict
 * Copyright (c) 2023 Michael Wiencek
 *
 * This source code is licensed under the MIT license. A copy can be found
 * in the file named "LICENSE" at the root directory of this distribution.
 */

// $FlowIssue[cannot-resolve-module]
import assert from 'node:assert';
// $FlowIssue[cannot-resolve-module]
import test from 'node:test';

import mutate from './index.js';

/*:: import * as types from './index.js'; */

const ERROR_REVOKED =
  /^Error: This context has been revoked and can no longer be used\.$/;

const ERROR_CLONE =
  /^Error: Only plain objects, arrays, and class instances can be cloned\./;

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
  +getValue: string,
  -setValue: string,
  +func: () => string,
  +numberObject: Number,
  +stringObject: String,
} */ = {
  _value: '',
  get getValue()/*: string */ {
    return unsupportedProperties._value;
  },
  set setValue(x/*: string */) {
    unsupportedProperties._value = x;
  },
  func: () => '',
  numberObject: new Number(1),
  stringObject: new String(''),
};

test('mutate', (t) => {
  t.test('throws if you pass null', (t) => {
    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      mutate(null);
    }, ERROR_CLONE);
  });

  t.test('throws if you pass a derived built-in', (t) => {
    class FunDate extends Date {}
    assert.throws(() => {
      mutate(new FunDate());
    }, ERROR_CLONE);
  });

  t.test('throws if you pass a generator', (t) => {
    function* makeGenerator() {
      yield 1;
    }
    assert.throws(() => {
      mutate(makeGenerator());
    }, ERROR_CLONE);
  });
});

test('read', (t) => {
  t.test('returns the original value if no changes were made', (t) => {
    assert.strictEqual(mutate(people).read()[0].birth_date.year, 2100);
  });

  t.test('returns the current changes', (t) => {
    const ctx = mutate(people);
    ctx.set(0, 'birth_date', 'year', 1988);
    assert.strictEqual(ctx.read()[0].birth_date.year, 1988);
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
    assert.notStrictEqual(copy, alice);
  });

  t.test('returns the current changes', (t) => {
    const ctx = mutate(people);
    ctx.set(0, 'birth_date', 'year', 1988);
    assert.strictEqual(ctx.write()[0].birth_date.year, 1988);
  });

  t.test('allows pushing array values', (t) => {
    const copy = mutate(people)
      .update((ctx) => ctx.write().push(alice))
      .final();
    assert.strictEqual(copy[2], alice);
  });

  t.test('can be called on child primitives', (t) => {
    const ctx = mutate(alice);
    ctx.get('birth_date', 'year').write();
    // $FlowIgnore[cannot-write]
    ctx.read().birth_date.year = 1988;
    const copy = ctx.final();
    assert.strictEqual(copy.birth_date.year, 1988);
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
    assert.strictEqual(ctx.get(), ctx);
  });

  t.test('works with one prop', (t) => {
    assert.strictEqual(mutate(alice).get('birth_date').read(), alice.birth_date);
  });

  t.test('works with two props', (t) => {
    assert.strictEqual(mutate(alice).get('birth_date', 'year').read(), alice.birth_date.year);
  });

  t.test('chains with other get calls', (t) => {
    assert.strictEqual(mutate(alice).get('birth_date').get('year').read(), alice.birth_date.year);
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.get('birth_date');
    }, ERROR_REVOKED);
  });

  t.test('throws on getters and setters', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      ctx.get('getValue');
    }, /^Error: Getters are unsupported\.$/);

    assert.throws(() => {
      ctx.get('setValue');
    }, /^Error: Setters are unsupported\.$/);
  });
});

test('set', (t) => {
  t.test('works directly on the root (one argument)', (t) => {
    let copy = mutate(alice)
      .set({...alice, birth_date: {...alice.birth_date, year: 1988}})
      .final();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
    copy = mutate(alice)
      .set(alice)
      .set('birth_date', 'year', 1999)
      .final();
    assert.strictEqual(copy.birth_date.year, 1999);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('works directly on a child (one argument)', (t) => {
    let copy = mutate(alice)
      .get('birth_date')
      .set({...alice.birth_date, year: 1988})
      .finalRoot();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
    copy = mutate(alice)
      .get('birth_date', 'year')
      .set(1999)
      .finalRoot();
    assert.strictEqual(copy.birth_date.year, 1999);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('works with one prop', (t) => {
    const copy = mutate(alice)
      .get('birth_date')
      .set('year', 1988)
      .finalRoot();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('works with two props', (t) => {
    const copy = mutate(alice)
      .set('birth_date', 'year', 1988)
      .final();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('chains with other set calls', (t) => {
    let copy = mutate(alice)
      .set('birth_date', 'year', 1988)
      .set('death_date', 'year', 2088)
      .final();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date.year, 2088);
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
    assert.deepStrictEqual(
      copy.birth_date,
      {year: 1990, month: 10, day: 21},
    );
    assert.deepStrictEqual(
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
    assert.strictEqual(alice, copy1);
    const copy2 = mutate(people)
      .set(0, people[0])
      .set(0, 'name', people[0].name)
      .set(0, 'birth_date', people[0].birth_date)
      .set(0, 'death_date', people[0].death_date)
      .set(0, 'birth_date', 'year', people[0].birth_date.year)
      .set(0, 'death_date', 'year', people[0].death_date.year)
      .final();
    assert.strictEqual(people, copy2);
  });

  t.test('clones the object only once', (t) => {
    const ctx = mutate(alice);
    ctx.get('birth_date').set('year', 1987);
    const newBirthDate1 = ctx.read().birth_date;
    ctx.get('birth_date').set('year', 1988);
    const newBirthDate2 = ctx.read().birth_date;
    assert.strictEqual(newBirthDate1, newBirthDate2);
  });

  t.test('throws if the context is revoked', (t) => {
    const ctx = mutate(alice);
    ctx.revoke();
    assert.throws(() => {
      ctx.set(alice);
    }, ERROR_REVOKED);
  });

  t.test('throws if called on a function', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('func').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('throws if called on a number object', (t) => {
    const ctx = mutate(unsupportedProperties);
    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('numberObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('can set number objects directly', (t) => {
    const copy = mutate(unsupportedProperties)
      .set('numberObject', new Number(2))
      .final();
    assert.strictEqual(+copy.numberObject, 2);
  });

  t.test('throws if called on a string object', (t) => {
    const ctx = mutate(unsupportedProperties);

    assert.throws(() => {
      // $FlowIgnore[incompatible-call]
      ctx.get('stringObject').set('error', null);
    }, ERROR_CLONE);
  });

  t.test('can set string objects directly', (t) => {
    const copy = mutate(unsupportedProperties)
      .set('stringObject', new String('huh'))
      .final();
    assert.strictEqual(String(copy.stringObject), 'huh');
  });

  t.test('works on class instances', (t) => {
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
    const copy = mutate(orig)
      .set('value', 'naughty')
      .final();
    assert.ok(copy instanceof NiceClass);
    assert.ok(copy instanceof NiceBase);
    assert.strictEqual(copy.value, 'naughty');
    assert.strictEqual(orig.value, 'nice');
  });

  t.test('can add custom properties to arrays', (t) => {
    const copy = mutate(people)
      // $FlowIgnore[incompatible-call]
      .set('customProp', 10)
      .final();
    // $FlowIgnore[prop-missing]
    assert.strictEqual(copy.customProp, 10);
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
    assert.strictEqual((copy1.x?.x), null);
    const copy2 = mutate(orig)
      // $FlowIgnore[incompatible-call]
      .set('x', 'x', 'x', null)
      .final();
    assert.strictEqual((copy2.x?.x?.x), null);
  });

  t.test('propagates changes to parent contexts', (t) => {
    const ctx = mutate/*:: <ReadOnlyPerson> */(alice);
    const birthDateContext1 = ctx.get('birth_date');
    const yearContext1 = birthDateContext1.get('year');

    birthDateContext1.set('year', 1988);
    // Should propagate to birthDateContext1 and yearContext1
    ctx.set('birth_date', {year: 2008});

    assert.strictEqual(ctx.get('birth_date').read().year, 2008);
    assert.strictEqual(birthDateContext1.read().year, 2008);
    assert.strictEqual(yearContext1.read(), 2008);
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
    assert.strictEqual(copy.prop1.foo, 'abc');
    assert.strictEqual(copy.prop2.foo, '123');
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
    assert.strictEqual(copy.ref?.name, 'hi');
  });
});

test('update', (t) => {
  t.test('works directly on the root (one argument)', (t) => {
    const ctx = mutate(alice);
    ctx.update((ctx2) => {
      assert.strictEqual(ctx, ctx2);
      ctx2.set('birth_date', 'year', 1988);
    });
    const copy = ctx.final();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('works directly on a child (one argument)', (t) => {
    const ctx = mutate(alice).get('birth_date');
    ctx.update((ctx2) => {
      assert.strictEqual(ctx, ctx2);
      ctx2.set('year', 1988);
    });
    const copy = ctx.finalRoot();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('works with one prop', (t) => {
    const ctx = mutate(alice);
    ctx.update('birth_date', (ctx2) => {
      assert.strictEqual(ctx.get('birth_date'), ctx2);
      ctx2.set('year', 1988);
    });
    const copy = ctx.finalRoot();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('works with two props', (t) => {
    const ctx = mutate(alice);
    ctx.update('birth_date', 'year', (ctx2) => {
      assert.strictEqual(ctx.get('birth_date', 'year'), ctx2);
      ctx2.set(1988);
    });
    const copy = ctx.finalRoot();
    assert.strictEqual(copy.birth_date.year, 1988);
    assert.strictEqual(copy.death_date, aliceDeathDate);
  });

  t.test('chains with other update calls', (t) => {
    let copy = mutate(alice)
      .update('birth_date', 'year', (ctx) => { ctx.set(1988); })
      .update('death_date', 'year', (ctx) => { ctx.set(2088); })
      .final();
  });
});

test('parent', (t) => {
  t.test('returns null on the root', (t) => {
    const ctx = mutate(alice);
    assert.strictEqual(ctx.parent(), null);
    ctx.revoke();
  });

  t.test('returns the parent of a child context', (t) => {
    const ctx = mutate(alice);
    assert.strictEqual(ctx.get('birth_date').parent(), ctx);
    ctx.revoke();
  });

  t.test('returns the parent of a grandchild context', (t) => {
    const ctx = mutate(alice);
    assert.strictEqual(ctx.get('birth_date', 'year').parent(), ctx.get('birth_date'));
    ctx.revoke();
  });
});

test('root', (t) => {
  t.test('returns the root on the root', (t) => {
    const ctx = mutate(alice);
    assert.strictEqual(ctx.root(), ctx);
    ctx.revoke();
  });

  t.test('returns the root of a child context', (t) => {
    const ctx = mutate(alice);
    assert.strictEqual(ctx.get('birth_date').root(), ctx);
    ctx.revoke();
  });

  t.test('returns the root of a grandchild context', (t) => {
    const ctx = mutate(alice);
    assert.strictEqual(ctx.get('birth_date', 'year').root(), ctx);
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

    assert.ok(Object.isFrozen(fooCopy));
    assert.strictEqual(fooCopy.bar, 'a');

    const rootCopy = rootCtx
      .set('foo', 'bar', 'b')
      .final();

    assert.ok(Object.isFrozen(rootCopy));
    assert.strictEqual(rootCopy.foo.bar, 'b');
  });

  t.test('preserves frozenness of objects', (t) => {
    const copy = mutate(alice).final();
    assert.ok(Object.isFrozen(copy));
    assert.ok(Object.isFrozen(copy.birth_date));
    assert.ok(Object.isFrozen(copy.death_date));
  });

  t.test('preserves frozenness of arrays', (t) => {
    const copy = mutate(people)
      .set(0, 'birth_date', 'year', 1988)
      .update((ctx) => {
        ctx.write().push(alice);
      })
      .final();
    assert.strictEqual(copy[0].birth_date.year, 1988);
    assert.strictEqual(copy[1], alice);
    assert.ok(Object.isFrozen(copy));
    assert.ok(Object.isFrozen(copy[0]));
    assert.ok(Object.isFrozen(copy[0].birth_date));
    assert.ok(Object.isFrozen(copy[0].death_date));
  });

  t.test('preserves sealedness of objects', (t) => {
    const orig/*: {+name: string, +address?: string} */ =
      Object.seal({name: ''});
    const copy = mutate(orig)
      .set('address', 'abc')
      .final();
    assert.ok(Object.isSealed(copy));
    assert.ok(!Object.isFrozen(copy));
  });

  t.test('preserves extensibility of objects', (t) => {
    const orig/*: {+name: string, +address?: string} */ =
      Object.preventExtensions({name: ''});
    const copy = mutate(orig)
      .set('address', 'abc')
      .final();
    assert.ok(!Object.isExtensible(copy));
    assert.ok(!Object.isSealed(copy));
    assert.ok(!Object.isFrozen(copy));
  });

  t.test('preserves descriptors for individual properties', (t) => {
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
    const copy = mutate(orig).set('a', '1').final();
    const copyDescriptors = Object.getOwnPropertyDescriptors(copy);
    assert.deepStrictEqual(copyDescriptors.a, {...origDescriptors.a, value: '1'});
    assert.deepStrictEqual(copyDescriptors.b, origDescriptors.b);
    assert.deepStrictEqual(copyDescriptors.c, origDescriptors.c);
    assert.deepStrictEqual(copyDescriptors.d, origDescriptors.d);
    assert.deepStrictEqual(copyDescriptors.e, origDescriptors.e);
    assert.deepStrictEqual(copyDescriptors.f, origDescriptors.f);
    assert.deepStrictEqual(copyDescriptors.g, origDescriptors.g);
    assert.deepStrictEqual(copyDescriptors.h, origDescriptors.h);
  });

  t.test('does not restore descriptors onto stale copies', (t) => {
    const root = Object.freeze({
      foo: Object.freeze({bar: '' /*:: as string */}),
    });

    const rootCtx = mutate(root);
    rootCtx.get('foo').set('bar', 'a');
    const tmpFoo = rootCtx.get('foo').write();

    assert.ok(!Object.isFrozen(tmpFoo));

    rootCtx.set('foo', Object.freeze({bar: 'b'}));
    rootCtx.get('foo').set('bar', 'c');

    const rootCopy = rootCtx.finalRoot();
    assert.ok(Object.isFrozen(rootCopy));
    assert.ok(Object.isFrozen(rootCopy.foo));
    assert.strictEqual(rootCopy.foo.bar, 'c');

    // `tmpFoo` is stale
    assert.ok(!Object.isFrozen(tmpFoo));
    assert.strictEqual(tmpFoo.bar, 'a');
  });

  t.test('preserves null prototypes', (t) => {
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

    const copy = mutate(orig)
      .get('value')
      .set('number', 2)
      .parent()
      .final();

    assert.strictEqual(orig.value.number, 1);
    assert.strictEqual(copy.value.number, 2);
    assert.strictEqual(Object.getPrototypeOf(copy), null);
    assert.strictEqual(Object.getPrototypeOf(copy.value), null);
  });
});
