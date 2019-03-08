# mutate-cow

This module allows you to update an immutable object as if it were mutable, inside a callback. It has copy-on-write semantics, so properties are only changed if you write to them. (In fact, if you perform no writes, the same object is returned back.) This makes it useful in conjuction with libraries like React, where state may be compared by reference.

It's implemented using [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) objects, so you may need a polyfill for older browsers.

While this doesn't appear to have been an original idea, I believe `mutate-cow` provides useful features that other packages don't:

 * All property descriptors from the immutable object are preserved.
 * The extensibility of the immutable object is preserved. Combined with the above point, this means that sealed objects stay sealed and frozen objects stay frozen.
 * Getters and setters from the immutable object can be used inside the callback, and are preserved in the copy; they aren't converted from accessors to writables.
 * Arrays, objects, and class instances are supported for mutation. Inside the callback, these have the correct identities when passed to `Array.isArray` or `instanceof`.
 * Usable Flow types are provided that don't freak out when you pass in a read-only object or array. (Property accesses and assignments are still type-checked in the callback.)

For usage, please see [the tests](test.mjs).

No cows were harmed in the making of this code.
