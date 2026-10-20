[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/store](../README.md) / ArcadeStoreOptions

# Interface: ArcadeStoreOptions\<T\>

How a store turns its stored text into a value and back.

## Type Parameters

### T

`T`

## Properties

### fallback

> **fallback**: `T`

What the store reads when nothing is stored, the stored text is
damaged, or the page is rendered on the server. Keep it one constant
value: React compares snapshots by identity.

***

### parse

> **parse**: (`raw`) => `T`

Reads the stored text. Throw when the text is not a value of this
store: the text is then set aside under `<key>:corrupt` and the store
reads `fallback`.

#### Parameters

##### raw

`string`

#### Returns

`T`

***

### retainInMemory?

> `optional` **retainInMemory?**: `boolean`

Whether a write that cannot reach localStorage is kept in memory for
the rest of the page (default true). Pass false for a store whose
readers should see only what localStorage holds.

***

### serialize

> **serialize**: (`value`) => `string`

Writes a value as the exact text to store.

#### Parameters

##### value

`T`

#### Returns

`string`

***

### upgrade?

> `optional` **upgrade?**: (`value`, `stored`) => `T` \| `null`

A one-time upgrade run when the store is settled. Given the current
value and whether anything was stored, it returns the value to write,
or null when there is nothing to do. It must return null once its own
result is stored, or it would write on every settle.

#### Parameters

##### value

`T`

##### stored

`boolean`

#### Returns

`T` \| `null`
