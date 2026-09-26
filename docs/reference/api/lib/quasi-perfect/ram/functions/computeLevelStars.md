[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/ram](../README.md) / computeLevelStars

# Function: computeLevelStars()

> **computeLevelStars**(`level`, `mode`, `remainingRam`, `usedSorry`): `number`

Stars for a solved level: 0 for a proof admitted with sorry, otherwise
1 to 3 by how little RAM the proof used. Both modes grade the RAM used
against the same gold and silver targets, so Story Mode's larger budget
makes a level harder to crash but not easier to three-star.

## Parameters

### level

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"initialRam"` \| `"goldRamTarget"` \| `"silverRamTarget"`\>

### mode

[`GameMode`](../../types/type-aliases/GameMode.md)

### remainingRam

`number`

### usedSorry

`boolean`

## Returns

`number`
