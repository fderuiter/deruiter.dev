[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-tags](../README.md) / parseRunTags

# Function: parseRunTags()

> **parseRunTags**(`value`): [`RunTags`](../interfaces/RunTags.md) \| `null`

Reads a stored record. Anything that is not a well-formed record (an
unknown view or input, a repeat, an assist that is not a string or a
boolean) reads as null, so a damaged record is dropped rather than
trusted. Checked by hand rather than with Zod, so the cabinet's shared
chunk does not carry Zod.

## Parameters

### value

`unknown`

The stored value.

## Returns

[`RunTags`](../interfaces/RunTags.md) \| `null`

The record, or null.
