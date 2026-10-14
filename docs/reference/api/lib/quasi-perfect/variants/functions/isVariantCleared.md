[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / isVariantCleared

# Function: isVariantCleared()

> **isVariantCleared**(`progress`, `levelId`, `kind`): `boolean`

Whether a variant has been cleared in saved progress.

## Parameters

### progress

`Pick`\<[`GameProgressState`](../../types/interfaces/GameProgressState.md), `"clearedVariants"`\> \| `null` \| `undefined`

Parsed campaign progress.

### levelId

`string` \| `number`

The level's id.

### kind

[`PuzzlerVariantKind`](../../types/type-aliases/PuzzlerVariantKind.md)

The variant kind.

## Returns

`boolean`

True when it was cleared before.
