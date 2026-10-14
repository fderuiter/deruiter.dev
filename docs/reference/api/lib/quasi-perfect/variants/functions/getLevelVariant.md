[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / getLevelVariant

# Function: getLevelVariant()

> **getLevelVariant**(`level`, `kind`): [`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md) \| `null`

Look up one variant of a level.

## Parameters

### level

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"id"`\>

The level, or anything carrying its id.

### kind

[`PuzzlerVariantKind`](../../types/type-aliases/PuzzlerVariantKind.md) \| `null` \| `undefined`

The variant kind, or null for the base level.

## Returns

[`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md) \| `null`

The variant, or null for the base level or a kind the level lacks.
