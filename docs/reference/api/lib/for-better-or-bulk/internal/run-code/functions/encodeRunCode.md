[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/run-code](../README.md) / encodeRunCode

# Function: encodeRunCode()

> **encodeRunCode**(`run`): `string`

Encodes a run as a `f1.` code. Throws a RangeError only for a run the game
could never have produced (an invalid setup or an unsupported frame), so the
caller can decide not to offer a code.

## Parameters

### run

[`SharedRun`](../interfaces/SharedRun.md)

## Returns

`string`
