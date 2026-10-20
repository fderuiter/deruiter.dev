[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/slice](../README.md) / write

# Function: write()

> **write**\<`T`\>(`slice`, `next`): `boolean`

Validates and stores a slice's value, then tells this tab's subscribers
with one `arcade_progress_changed` event (other tabs hear the native
`storage` event). A value that fails the schema is not written.

## Type Parameters

### T

`T`

## Parameters

### slice

[`ArcadeSlice`](../interfaces/ArcadeSlice.md)\<`T`\>

The slice to write.

### next

`T`

The new value.

## Returns

`boolean`

True when the value reached localStorage.
