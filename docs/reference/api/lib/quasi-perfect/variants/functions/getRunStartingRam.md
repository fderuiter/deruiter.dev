[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / getRunStartingRam

# Function: getRunStartingRam()

> **getRunStartingRam**(`level`, `mode`, `variant`): `number`

RAM a run starts with. The Tight RAM variant replaces the mode budget with
its fixed allowance; every other run uses the mode's normal budget.

## Parameters

### level

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"initialRam"`\>

The level being played.

### mode

[`GameMode`](../../types/type-aliases/GameMode.md)

Story or Hacker mode.

### variant

`Pick`\<[`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md), `"startingRam"`\> \| `null` \| `undefined`

The active variant, or null for the base level.

## Returns

`number`

Starting RAM in GB.
