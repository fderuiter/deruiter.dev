[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/bundle-guard](../README.md) / chunkGzipBudget

# Function: chunkGzipBudget()

> **chunkGzipBudget**(`source`, `isInitial`): `number`

Returns the gzip ceiling that applies to one chunk: a lazy vendor ceiling
when a non-initial chunk carries that vendor's marker, otherwise the
default single-chunk budget.

## Parameters

### source

`string`

### isInitial

`boolean`

## Returns

`number`
