[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / read

# Function: read()

> **read**\<`T`\>(`slice`): `T`

A slice's current value. Sets a damaged value aside and runs the slice's
one-time upgrade first, so call it from handlers and game code; in a
component use [useProgress](useProgress.md).

## Type Parameters

### T

`T`

## Parameters

### slice

[`ArcadeSlice`](../interfaces/ArcadeSlice.md)\<`T`\>

The slice to read.

## Returns

`T`

The value.
