[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/rng](../README.md) / SessionRng

# Interface: SessionRng

A seedable random stream whose whole state is one plain number, so a run
snapshot can carry it and a restored run draws the same numbers.

Methods do not rely on `this`, so `rng.next` can be passed detached, for
example as a `random` parameter or a `Math.random` stub.

## Properties

### chance

> `readonly` **chance**: (`probability`) => `boolean`

True with probability `probability`: never at 0 or below (or NaN),
always at 1 or above. Always takes exactly one draw, so a branch on the
result does not shift the stream.

#### Parameters

##### probability

`number`

#### Returns

`boolean`

***

### getState

> `readonly` **getState**: () => `number`

The stream's state, an unsigned 32-bit integer.

#### Returns

`number`

***

### int

> `readonly` **int**: (`maxExclusive`) => `number`

An integer in [0, maxExclusive). Throws RangeError unless
`maxExclusive` is a positive integer.

#### Parameters

##### maxExclusive

`number`

#### Returns

`number`

***

### next

> `readonly` **next**: () => `number`

The next value in [0, 1).

#### Returns

`number`

***

### pick

> `readonly` **pick**: \<`T`\>(`items`) => `T`

One item of a non-empty list. Throws RangeError on an empty list.

#### Type Parameters

##### T

`T`

#### Parameters

##### items

readonly `T`[]

#### Returns

`T`

***

### range

> `readonly` **range**: (`min`, `max`) => `number`

A number in [min, max). Returns `min` when the two are equal.

#### Parameters

##### min

`number`

##### max

`number`

#### Returns

`number`

***

### setState

> `readonly` **setState**: (`state`) => `void`

Moves the stream to a state from [SessionRng.getState](#getstate). Throws
RangeError unless `state` is an integer in [0, 2^32).

#### Parameters

##### state

`number`

#### Returns

`void`
