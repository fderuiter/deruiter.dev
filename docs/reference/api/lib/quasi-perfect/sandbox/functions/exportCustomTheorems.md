[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/sandbox](../README.md) / exportCustomTheorems

# Function: exportCustomTheorems()

> **exportCustomTheorems**(`theorems`): `string`

Serialize the collection for download. Ids are left out, because an
import always assigns new ones.

## Parameters

### theorems

readonly [`CustomTheorem`](../interfaces/CustomTheorem.md)[]

The saved collection.

## Returns

`string`

Pretty-printed JSON with a version and a theorems array.
