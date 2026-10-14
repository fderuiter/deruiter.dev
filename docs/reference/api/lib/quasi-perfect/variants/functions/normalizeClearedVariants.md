[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / normalizeClearedVariants

# Function: normalizeClearedVariants()

> **normalizeClearedVariants**(`raw`): `Record`\<`string`, [`PuzzlerVariantKind`](../../types/type-aliases/PuzzlerVariantKind.md)[]\>

Clean a stored `clearedVariants` value: anything that is not an object of
arrays becomes empty, and unknown or repeated kinds are dropped.

## Parameters

### raw

`unknown`

The stored value, possibly missing or malformed.

## Returns

`Record`\<`string`, [`PuzzlerVariantKind`](../../types/type-aliases/PuzzlerVariantKind.md)[]\>

A safe map from level id to cleared kinds.
