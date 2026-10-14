[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/shop](../README.md) / drawWeighted

# Function: drawWeighted()

> **drawWeighted**\<`T`\>(`seed`, `drawIndex`, `pool`, `count`, `weight`): `object`

Draws up to `count` distinct items from `pool` without replacement on the
shop stream, each in proportion to its `weight`, starting at `drawIndex`
(#2083). Consumes one draw per item taken, like `drawDistinct`, so the
same seed and pool give the same items.

## Type Parameters

### T

`T`

## Parameters

### seed

`string`

### drawIndex

`number`

### pool

readonly `T`[]

### count

`number`

### weight

(`item`) => `number`

## Returns

`object`

### items

> **items**: `T`[]

### next

> **next**: `number`
