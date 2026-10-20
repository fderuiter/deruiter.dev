[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / ArcadeSlice

# Interface: ArcadeSlice\<T\>

A defined slice. Read and write it with `read`, `write` and friends.

## Extends

- [`ArcadeSliceInfo`](ArcadeSliceInfo.md)

## Type Parameters

### T

`T`

## Properties

### class

> `readonly` **class**: [`ArcadeSliceClass`](../type-aliases/ArcadeSliceClass.md)

#### Inherited from

[`ArcadeSliceInfo`](ArcadeSliceInfo.md).[`class`](ArcadeSliceInfo.md#class)

***

### empty

> `readonly` **empty**: () => `T`

#### Returns

`T`

***

### id

> `readonly` **id**: `string`

#### Inherited from

[`ArcadeSliceInfo`](ArcadeSliceInfo.md).[`id`](ArcadeSliceInfo.md#id)

***

### key

> `readonly` **key**: `string`

#### Inherited from

[`ArcadeSliceInfo`](ArcadeSliceInfo.md).[`key`](ArcadeSliceInfo.md#key)

***

### merge

> `readonly` **merge**: (`a`, `b`) => `T`

#### Parameters

##### a

`T`

##### b

`T`

#### Returns

`T`

***

### spendable

> `readonly` **spendable**: `boolean`

#### Inherited from

[`ArcadeSliceInfo`](ArcadeSliceInfo.md).[`spendable`](ArcadeSliceInfo.md#spendable)

***

### store

> `readonly` **store**: [`ArcadeStore`](../../store/interfaces/ArcadeStore.md)\<`T`\>

The store underneath.

***

### validate

> `readonly` **validate**: (`value`) => `T` \| `null`

Checks a value against the slice's schema; null when it fails.

#### Parameters

##### value

`unknown`

#### Returns

`T` \| `null`

***

### version

> `readonly` **version**: `number`

#### Inherited from

[`ArcadeSliceInfo`](ArcadeSliceInfo.md).[`version`](ArcadeSliceInfo.md#version)
