# mutate-cow

```JavaScript
import mutate from 'mutate-cow';

const animals = Object.freeze({
  cats: Object.freeze(['ragamuffin', 'shorthair', 'maine coon']),
});

const newAnimals = mutate(animals, copy => {
  copy.cats.push('bobtail');
  copy.dogs = Object.freeze(['hound']);
});
```

This module allows you to update an immutable object as if it were mutable, inside a callback. It has copy-on-write semantics, so properties are only changed if you write to them. (In fact, if you perform no writes, the same object is returned back.) This makes it useful in conjuction with libraries like React, where state may be compared by reference.

It's implemented using [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) objects. A slow path that recursively clones and compares objects is used if `Proxy` is unavailable, but it's not fully compatible.

While this doesn't appear to have been an original idea, I believe `mutate-cow` provides useful features that other packages don't:

 * All property descriptors from the immutable object are preserved in the copy.
 * All extensibility information from the immutable object is preserved in the copy. Combined with the above point, this means that sealed objects stay sealed and frozen objects stay frozen. (Inside the callback, of course, the working copy in unsealed and all properties are writable.)
 * Getters and setters from the immutable object can be used inside the callback, and are preserved in the copy; they aren't converted from accessors to writables.
 * Arrays, objects, and class instances are supported for mutation. Inside the callback, these have the correct identities when passed to `Array.isArray` or `instanceof`.
 * Usable Flow types are provided. (The first type parameter must be a non-read-only variant of the input type.)

For usage, please see [the tests](test.mjs).

No cows were harmed in the making of this code.

## Caveats

This module works for mutating plain objects, arrays, and user-defined classes. (Note, however, that class constructors are not called.) Other native, built-in object types are not supported for a variety reasons. For one, many of them can't be proxied correctly, because their methods aren't generic; i.e., they can't be called with a `this` value that's not of the exact object type. Another reason is that we'd need specialized code to clone each different type; they can't be created with `Object.create`, as the constructor must be called to define internal slots. We'd need further specialized code to intercept any methods that can write to any internal slots. That's just not feasible.

Note that there's nothing wrong with creating *new* instances of these objects inside the callback and assigning them to properties. It's perfectly fine to clone them yourself. What's unsupported is mutating any existing objects of these types.

```JavaScript
const orig = {
  date: new Date(),
  string: new String('hello'),
};

mutate(orig, copy => {
  // These are unsupported, and will throw TypeErrors.
  copy.date.setFullYear(1999);
  copy.date.customProp = 'y';
  copy.string[0] = 'y';

  // These are fine.
  const newDate = new Date(orig.date.valueOf());
  newDate.setFullYear(1999);
  newDate.customProp = 'y';
  copy.date = newDate;
  copy.string = new String('yello');
});
```

### Unwrapping proxied values

When you read from a property inside the callback, a `Proxy` is returned that can read from the source object (or working copy) and write to the copy. You may then wonder what happens if you perform `copy.foo = copy.bar`: will this assign a `Proxy`, or the value it targets? The answer in this case is the value it targets, because `mutate-cow` automatically unwraps proxied values on the RHS of assignments. However, suppose you did something like this instead:

```JavaScript
const orig = {foo: {value: 1}, bar: {value: 2}};

const copy = mutate(orig, copy => {
  // this will assign an object resembling {value: Proxy}!
  copy.foo = {...copy.bar};
});
```

In the above case, `copy.bar.value` is a `Proxy`, but `{...copy.bar}` (the assigned object) is not. `mutate-cow` doesn't *deeply* unwrap values, so you have to do it yourself in this case:

```JavaScript
const orig = {foo: {value: 1}, bar: {value: 2}};

const copy = mutate(orig, (copy, unwrap) => {
  copy.foo = {...unwrap(copy.bar)};
});
```

If you don't do this, accessing `copy.foo.value` outside the callback will throw an error, because the `Proxy` will be revoked! An alternative which avoids this situation entirely is to just reference the source object where possible:

```JavaScript
const orig = {foo: {value: 1}, bar: {value: 2}};

const copy = mutate(orig, copy => {
  copy.foo = {...orig.bar};
});
```

In fact, all `unwrap` does is return the underlying data from the source, or the working copy where you've made changes.
