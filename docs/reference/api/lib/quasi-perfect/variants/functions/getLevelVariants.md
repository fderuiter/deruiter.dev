[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / getLevelVariants

# Function: getLevelVariants()

> **getLevelVariants**(`level`): [`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md)[]

The variants a level offers, in picker order. A level without a par has
no step-limit variant; a level without an authored ban has no banned one.

## Parameters

### level

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"id"`\>

The level, or anything carrying its id.

## Returns

[`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md)[]

The level's variants; empty for a level without authored rules.
