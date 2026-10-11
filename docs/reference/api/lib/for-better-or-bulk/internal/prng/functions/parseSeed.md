[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/prng](../README.md) / parseSeed

# Function: parseSeed()

> **parseSeed**(`raw`): `number`

Reads a seed from a link's query text. Anything that is not a whole number
from 0 to MAX_SEED counts as junk and gives the standard day, seed 0.

## Parameters

### raw

`string` \| `null` \| `undefined`

## Returns

`number`
