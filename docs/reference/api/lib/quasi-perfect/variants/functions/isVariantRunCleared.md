[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / isVariantRunCleared

# Function: isVariantRunCleared()

> **isVariantRunCleared**(`variant`, `steps`, `usedSorry`): `boolean`

Whether a finished run clears its variant: an honest proof inside the
variant's limits.

## Parameters

### variant

`Pick`\<[`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md), `"stepLimit"`\>

The variant the run was played under.

### steps

`number`

Tactics the run applied.

### usedSorry

`boolean`

Whether the run admitted any goal with `sorry`.

## Returns

`boolean`

True when the variant counts as cleared.
