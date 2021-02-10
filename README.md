# mutate-cow

```JavaScript
import mutate from 'mutate-cow';

mutate({ cats: ['ragamuffin'] })
  .get('cats')
  .run(x => { x.push('bobtail') });
```

This module aims to help make deep, immutable updates to objects easier. It has copy-on-write semantics, so properties are only changed if you write to them. (If you perform no writes, the same object is returned back.) This makes it useful in conjunction with libraries like React, where state may be compared by reference.

While this doesn't appear to have been an original idea, I believe `mutate-cow` provides useful features that other packages don't:

 * Properties' data/access descriptors are preserved in the copy.
 * Extensibility information is preserved in the copy. This means that sealed objects come back sealed and frozen objects come back frozen.
 * Class instances are supported for mutation.
 * Usable Flow types are provided.

No cows were harmed in the making of this code.

## API

### mutate<T>(value: T): Mutator<T>

Returns a `Mutator` that can be used to modify `value` (which is assumed to be immutable).

To update sub-objects, you'll want to use the `get` method below.

### Mutator.result

The current working copy of the `value` passed to `mutate`, or original value if no changes were made.

You can read `result`, but don't modify it. That would defeat the purpose of `mutate-cow` and likely cause weird things to happen.

```JavaScript
const orig = {};

const m = mutate(orig);

m.result === orig; // true

const newObj = {};

m.set(newObj);

m.result === newObj; // true
```

### Mutator.final()

Finalizes the mutator: adds back any data/access descriptors that were present on the original object, cleans up the internal state, and returns `result`.

You can't use the mutator again after calling this.

```JavaScript
const mFoo = mutate({bar: 1});
const mBar = mFoo.get('bar');

mFoo.final(); // {bar: 1}

mBar.set(1); // error
mFoo.get('bar'); // error
```

### Mutator.get(property)

Returns a child mutator that corresponds to `value[property]`. This is also a `Mutator` instance, though it remembers its parent. Updating a child via `set` or `run` also updates the parent.

```JavaScript
const mFoo = mutate({bar: 1});
const mBar = mFoo.get('bar');

mBar.final() === 1; // true
mFoo.final().bar === 1; // true
```

### Mutator.set(property)

Updates the value we're pointing to. Returns `this.final()`, so can only be called once.

```JavaScript
const o = {bar: 1};
const m = mutate(o);

m.get('bar').set(2); // 2
m.final().bar === 2; // true

o.bar === 1; // still true
```

### Mutator.run(callback)

Does a shallow clone of the source value and runs the given callback on it. Returns `this.final()`, so can only be called once.

```JavaScript
const o = [1];

mutate(o).run(x => { x.push(2) }); // [1, 2]

o.length === 1; // still true
```

Do not perform deep updates inside the callback:

```JavaScript
const o = [{}];

const newo = mutate(o).run(x => {
  // NO. This defeats the purpose of mutate-cow.
  x[0].foo = 1;
});
```

Generally your Flow object types should be read-only to prevent this sort of misuse.

## Caveats

This module works for mutating plain objects, arrays, and user-defined classes. (Note, however, that class constructors are not called.) Other native, built-in object types (e.g. `Date`) are not supported, mainly because there's not a consistent way to clone them (their constructors generally need to be called to define intenral slots).
