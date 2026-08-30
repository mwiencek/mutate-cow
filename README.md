# mutate-cow

```JavaScript
import mutate from 'mutate-cow';

const animals = deepFreeze({
  cats: ['ragamuffin', 'shorthair', 'maine coon'],
});

const newAnimals = mutate(animals)
  .set('dogs', ['hound'])
  .update('cats', (ctx) => {
    ctx.write().push('bobtail');
  })
  .final();
```

This module allows you to update an immutable object as if it were mutable. It has copy-on-write semantics, so properties are only changed if you write to them. (In fact, if you perform no writes, the same object is returned back.) This makes it useful in conjuction with libraries like React, where state may be compared by reference.

No cows were harmed in the making of this code.

## API

### const ctx = mutate(source)

Returns a "context" object which can modify a copy of `source`.

```js
const foo = deepFreeze({bar: {baz: []}});
const ctx = mutate(foo);
````

You can mutate primitives, arrays, and plain objects. However, note that `null` prototypes and frozenness are not preserved.

### ctx.read()

Returns the current working copy of the context's `source` object, or just `source` if no changes were made.

```js
ctx.read() === foo; // no changes
ctx.set('bar', 'baz', ['qux']);
ctx.read().bar.baz[0] === 'qux'; // changes
```

### ctx.write()

Returns the current working copy of the context's `source` object. Makes a shallow copy of `source` first if no changes were made.

You normally don't need to call `write`. It's mainly useful for accessing methods on copied objects (e.g., array methods).

```js
ctx.get('bar', 'baz').write().push('qux');
ctx.read().bar.baz[0] === 'qux';
```

### ctx.get(...path: [prop1, ...])

Returns a child context object for the given `path`.

Passing zero arguments returns `ctx`.

```js
ctx.get() === ctx;
ctx.get('bar').read() === foo.bar;
ctx.get('bar', 'baz').read().length === 0;
```

### ctx.set(...path: [prop1, ...], value)

Sets the given `path` to `value` on the current working copy. Returns `ctx`.

Passing zero property names (i.e., only a value) sets the current context's value.

Only own properties are written.

```js
const qux = ['qux'];
// these all do the same thing
ctx.set({bar: {baz: qux}});
ctx.set('bar', {baz: qux});
ctx.set('bar', 'baz', qux);
ctx.get('bar').set({baz: qux});
ctx.get('bar').set('baz', qux);
ctx.get('bar', 'baz').set(qux);

// sets the own property '__proto__', not the prototype
ctx.set('__proto__', {});
```

### ctx.merge(object)

Recursively merges a plain `object` into the current working copy, as if `set` were called with each of its own enumerable key/value pairs. Returns `ctx`.

Keys that aren't defined in `object` are preserved on the working copy. Values that aren't plain objects (including arrays, class instances, and primitives) replace the existing value.

Only own properties are written.

```js
ctx.merge({bar: {qux: 1}});
ctx.read().bar.qux === 1;
ctx.read().bar.baz === foo.bar.baz; // other properties are preserved

// these all do the same thing
ctx.merge({bar: {qux: 1}});
ctx.get('bar').merge({qux: 1});
ctx.set('bar', 'qux', 1);
```

### ctx.update(...path: [prop1, ...], updater)

Calls `updater(ctx.get(...path))` and returns `ctx`.

```js
const copy = ctx
  .update('bar', 'baz', (bazCtx) => {
    bazCtx.write().push('qux');
  })
  .final();
copy.bar.baz[0] === 'qux';
````

### ctx.parent()

Returns the parent context of `ctx`.

```js
ctx.parent() === null;
ctx.get('bar').parent() === ctx;
ctx.get('bar', 'baz').parent() === ctx.get('bar');
````

### ctx.root()

Returns the root context of `ctx`.

```js
ctx.root() === ctx;
ctx.get('bar').root() === ctx;
ctx.get('bar', 'baz').root() === ctx;
````

### ctx.revoke()

Revokes `ctx` so that it can no longer be used. Returns `undefined`.

Attempting to use any method other than `isRevoked` on a revoked context will throw an error. This sets all internal properties to `null` so that there's no longer any reference to the `source` object or copy.

### ctx.isRevoked()

Returns a boolean indicating whether `ctx` has been revoked.

### ctx.final()

This is the same as `read`, except it also revokes the context. This is what you call to get the final copy.

```js
const copy = mutate(foo).set('bar', 'baz', 'qux').final();
````

### ctx.finalRoot()

Returns `ctx.root().final()`.
