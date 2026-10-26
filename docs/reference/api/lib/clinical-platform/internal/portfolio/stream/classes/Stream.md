[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/stream](../README.md) / Stream

# Class: Stream

A deterministic sequence of uniform draws for one seed and label.

## Constructors

### Constructor

> **new Stream**(`seed`, `label`): `Stream`

#### Parameters

##### seed

`number`

##### label

`string`

#### Returns

`Stream`

## Methods

### chance()

> **chance**(`p`): `boolean`

`true` with probability `p`.

#### Parameters

##### p

`number`

#### Returns

`boolean`

***

### expInt()

> **expInt**(`mean`): `number`

An exponential draw with the given mean, rounded down to an integer.

#### Parameters

##### mean

`number`

#### Returns

`number`

***

### int()

> **int**(`min`, `max`): `number`

An integer in [min, max], both inclusive.

#### Parameters

##### min

`number`

##### max

`number`

#### Returns

`number`

***

### next()

> **next**(): `number`

The next uniform draw in [0, 1).

#### Returns

`number`

***

### normal()

> **normal**(`mean`, `sd`): `number`

A normal draw with the given mean and standard deviation (Box-Muller,
two uniform draws per call, the sine half discarded).

#### Parameters

##### mean

`number`

##### sd

`number`

#### Returns

`number`

***

### pick()

> **pick**\<`T`\>(`items`): `T`

One element of a non-empty list.

#### Type Parameters

##### T

`T`

#### Parameters

##### items

readonly `T`[]

#### Returns

`T`

***

### poisson()

> **poisson**(`mean`): `number`

A Poisson count with the given mean (Knuth's method, for small means).

#### Parameters

##### mean

`number`

#### Returns

`number`

***

### real()

> **real**(`min`, `max`): `number`

A uniform real in [min, max).

#### Parameters

##### min

`number`

##### max

`number`

#### Returns

`number`

***

### shuffle()

> **shuffle**\<`T`\>(`items`): `T`[]

A shuffled copy of a list (Fisher-Yates).

#### Type Parameters

##### T

`T`

#### Parameters

##### items

readonly `T`[]

#### Returns

`T`[]

***

### weighted()

> **weighted**(`weights`): `number`

The index of a weight, drawn in proportion to the weights.

#### Parameters

##### weights

readonly `number`[]

#### Returns

`number`
