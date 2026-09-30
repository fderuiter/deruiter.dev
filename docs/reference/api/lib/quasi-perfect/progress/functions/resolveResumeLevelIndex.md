[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / resolveResumeLevelIndex

# Function: resolveResumeLevelIndex()

> **resolveResumeLevelIndex**(`progress`, `levels`): `number`

Choose the level the campaign reopens on.

A saved index of 1 or more that names a real level is used as is. An
index of 0, or no index at all, is what saves written before the index
was recorded contain, so the first unsolved level is chosen instead
(Level 1 when nothing or everything is solved). Any other value, such as
an out-of-range, fractional or non-numeric index, falls back to Level 1.

## Parameters

### progress

`Partial`\<[`GameProgressState`](../../types/interfaces/GameProgressState.md)\> \| `null` \| `undefined`

Parsed campaign progress.

### levels

readonly `Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"id"`\>[]

The campaign's levels, in order.

## Returns

`number`

A valid index into `levels`.
