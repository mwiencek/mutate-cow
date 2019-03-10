# mutate-cow

This module allows you to update an immutable object as if it were mutable, inside a callback. It has copy-on-write semantics, so properties are only changed if you write to them. (In fact, if you perform no writes, the same object is returned back.) This makes it useful in conjuction with libraries like React, where state may be compared by reference.

It's implemented using [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) objects, so you may need a polyfill for older browsers.

While this doesn't appear to have been an original idea, I believe `mutate-cow` provides useful features that other packages don't:

 * All property descriptors from the immutable object are preserved in the copy.
 * All extensibility information from the immutable object is preserved in the copy. Combined with the above point, this means that sealed objects stay sealed and frozen objects stay frozen. (Inside the callback, of course, the working copy in unsealed and all properties are writable.)
 * Getters and setters from the immutable object can be used inside the callback, and are preserved in the copy; they aren't converted from accessors to writables.
 * Arrays, objects, and class instances are supported for mutation. Inside the callback, these have the correct identities when passed to `Array.isArray` or `instanceof`.
 * Usable Flow types are provided that don't freak out when you pass in a read-only object or array. (Property accesses and assignments are still type-checked in the callback.)

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
