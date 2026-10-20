[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / ArcadeSliceDefinition

# Interface: ArcadeSliceDefinition\<T\>

Everything that defines a slice.

## Type Parameters

### T

`T`

## Properties

### class

> **class**: [`ArcadeSliceClass`](../type-aliases/ArcadeSliceClass.md)

***

### empty

> **empty**: () => `T`

The value when nothing is stored.

#### Returns

`T`

***

### format?

> `optional` **format?**: [`ArcadeSliceFormat`](../type-aliases/ArcadeSliceFormat.md)

How the value is framed in storage; `json` unless given.

***

### id

> **id**: `string`

A stable name, e.g. `arcade.core`.

***

### key

> **key**: `string`

The storage key, exactly as the game wrote it before.

***

### merge

> **merge**: (`a`, `b`) => `T`

Combines two copies of the slice. For a profile slice it must be a join:
commutative, associative, idempotent, and never lower a best.

#### Parameters

##### a

`T`

##### b

`T`

#### Returns

`T`

***

### migrate?

> `optional` **migrate?**: (`value`, `fromVersion`) => `unknown`

Brings a value stored at `fromVersion` up to `version`.

#### Parameters

##### value

`unknown`

##### fromVersion

`number`

#### Returns

`unknown`

***

### retainInMemory?

> `optional` **retainInMemory?**: `boolean`

Whether a refused write is kept in memory for the page (default true).

***

### schema

> **schema**: [`ArcadeSliceSchema`](ArcadeSliceSchema.md)\<`T`\>

Checks a stored (and migrated) value. A value it rejects is corrupt.

***

### spendable?

> `optional` **spendable?**: `boolean`

Holds a balance that can go down (Labyrinth's crypto), so it merges by
last writer rather than by `max`.

***

### upgrade?

> `optional` **upgrade?**: (`value`, `stored`) => `T` \| `null`

A one-time upgrade, as for `createArcadeStore`.

#### Parameters

##### value

`T`

##### stored

`boolean`

#### Returns

`T` \| `null`

***

### version

> **version**: `number`

The current version. A stored value's version is its `version` field,
or 0 when it has none.
