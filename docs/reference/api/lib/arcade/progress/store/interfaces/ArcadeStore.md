[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/store](../README.md) / ArcadeStore

# Interface: ArcadeStore\<T\>

A typed view of one localStorage key.

## Type Parameters

### T

`T`

## Properties

### fallback

> `readonly` **fallback**: `T`

The value read when nothing usable is stored.

***

### key

> `readonly` **key**: `string`

The storage key, unchanged from what the game stored before.

## Methods

### get()

> **get**(): `T`

The current value. Pure: it never writes, so it is safe in a render or
a `useSyncExternalStore` snapshot, and it returns the same object while
the stored text is unchanged.

#### Returns

`T`

***

### set()

> **set**(`value`): `boolean`

Stores a value and tells this tab's subscribers. Returns true when the
value reached localStorage. A damaged stored value is set aside first,
never overwritten.

#### Parameters

##### value

`T`

#### Returns

`boolean`

***

### settle()

> **settle**(): `T`

Sets a damaged stored value aside and runs the store's upgrade, then
returns the current value. Writes, so call it from an event handler or
an effect, not while rendering.

#### Returns

`T`

***

### subscribe()

> **subscribe**(`onChange`): () => `void`

Calls `onChange` after a write to this key in this tab or another one.
Returns the function that stops listening.

#### Parameters

##### onChange

() => `void`

#### Returns

() => `void`

***

### useValue()

> **useValue**(): `T`

The current value in a React component, kept up to date across tabs.
The server render and the first client render read `fallback`.

#### Returns

`T`
