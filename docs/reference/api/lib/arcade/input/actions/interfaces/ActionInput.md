[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / ActionInput

# Interface: ActionInput\<A\>

One action input, from any device.

## Type Parameters

### A

`A` *extends* `string` = `string`

## Properties

### action

> `readonly` **action**: `A`

***

### code?

> `readonly` `optional` **code?**: `string`

The physical key, for keyboard input.

***

### phase

> `readonly` **phase**: [`ActionPhase`](../type-aliases/ActionPhase.md)

***

### preventDefault

> `readonly` **preventDefault**: () => `void`

Prevents the browser default of the key that caused it. A no-op elsewhere.

#### Returns

`void`

***

### repeat

> `readonly` **repeat**: `boolean`

True for an auto-repeat of a held key or control.

***

### source

> `readonly` **source**: [`ActionSource`](../type-aliases/ActionSource.md)

***

### value?

> `readonly` `optional` **value?**: [`ActionVector`](ActionVector.md)

The vector of an `axis2d` action.
