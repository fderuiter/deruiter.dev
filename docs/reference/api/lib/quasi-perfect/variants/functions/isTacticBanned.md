[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / isTacticBanned

# Function: isTacticBanned()

> **isTacticBanned**(`variant`, `tacticId`): `boolean`

Whether the active variant bans a tactic.

## Parameters

### variant

`Pick`\<[`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md), `"bannedTactic"`\> \| `null` \| `undefined`

The active variant, or null for the base level.

### tacticId

[`TacticId`](../../types/type-aliases/TacticId.md)

The tactic to check.

## Returns

`boolean`

True when the card cannot be played in this run.
