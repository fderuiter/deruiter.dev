[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / recordClearedVariant

# Function: recordClearedVariant()

> **recordClearedVariant**(`progress`, `levelId`, `kind`): [`GameProgressState`](../../types/interfaces/GameProgressState.md)

Record a cleared variant. The base level's score is left untouched, so a
variant never changes its stars, Golfed badge or steps.

## Parameters

### progress

[`GameProgressState`](../../types/interfaces/GameProgressState.md)

Current campaign progress.

### levelId

`string` \| `number`

The level's id.

### kind

[`PuzzlerVariantKind`](../../types/type-aliases/PuzzlerVariantKind.md)

The variant just cleared.

## Returns

[`GameProgressState`](../../types/interfaces/GameProgressState.md)

New progress with the variant recorded, in picker order.
