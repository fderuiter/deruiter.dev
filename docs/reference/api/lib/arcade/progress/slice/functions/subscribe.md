[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / subscribe

# Function: subscribe()

> **subscribe**\<`T`\>(`slice`, `onChange`): () => `void`

Calls `onChange` after any write to the slice, in this tab or another.

## Type Parameters

### T

`T`

## Parameters

### slice

[`ArcadeSlice`](../interfaces/ArcadeSlice.md)\<`T`\>

The slice to watch.

### onChange

() => `void`

Called after each write.

## Returns

A function that stops listening.

() => `void`
