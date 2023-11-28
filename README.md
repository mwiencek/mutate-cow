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

`mutate-cow` provides useful features that other packages don't:

 * All property descriptors from the immutable object are preserved in the copy.
 * All extensibility information from the immutable object is preserved in the copy. Combined with the above point, this means that sealed objects stay sealed and frozen objects stay frozen.
 * Arrays, objects, and class instances are supported for mutation.
 * Flow and TypeScript definitions are provided.

No cows were harmed in the making of this code.

## API

### const ctx = mutate(source)

Returns a "context" object which can modify a copy of `source`.

```js
const foo = deepFreeze({bar: {baz: []}});
const ctx = mutate(foo);
````

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

```js
const qux = ['qux'];
// these all do the same thing
ctx.set({bar: {baz: qux}});
ctx.set('bar', {baz: qux});
ctx.set('bar', 'baz', qux);
ctx.get('bar').set({baz: qux});
ctx.get('bar').set('baz', qux);
ctx.get('bar', 'baz').set(qux);
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

This is the same as `read`, except it also revokes the context and restores all property descriptors and extensibility information. This is what you call to get the final copy.

```js
const copy = mutate(foo).set('bar', 'baz', 'qux').final();
Object.isFrozen(copy) === true; // since `foo` was frozen, `copy` will be too
````

### ctx.finalRoot()

Returns `ctx.root().final()`.
