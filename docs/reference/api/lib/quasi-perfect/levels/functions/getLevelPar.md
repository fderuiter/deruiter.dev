[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/levels](../README.md) / getLevelPar

# Function: getLevelPar()

> **getLevelPar**(`level`): `number` \| `null`

Step par for a level: how many tactics its reference proof applies.

## Parameters

### level

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"id"`\>

The level, or anything carrying its id.

## Returns

`number` \| `null`

The par in tactics, or null for a level without a reference proof.
