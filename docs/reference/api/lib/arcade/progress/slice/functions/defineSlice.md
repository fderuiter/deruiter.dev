[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / defineSlice

# Function: defineSlice()

> **defineSlice**\<`T`\>(`definition`): [`ArcadeSlice`](../interfaces/ArcadeSlice.md)\<`T`\>

Defines a slice over an existing key. Nothing is moved or rewritten: the
first write stores the same format the game used before.

## Type Parameters

### T

`T`

## Parameters

### definition

[`ArcadeSliceDefinition`](../interfaces/ArcadeSliceDefinition.md)\<`T`\>

The slice's key, schema, version and merge.

## Returns

[`ArcadeSlice`](../interfaces/ArcadeSlice.md)\<`T`\>

The slice.
