[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / isStepLimitReached

# Function: isStepLimitReached()

> **isStepLimitReached**(`variant`, `steps`, `solved`): `boolean`

Whether a step-limit run has failed: it has used every allowed tactic and
the proof is still open, so the next tactic would be over the limit.

## Parameters

### variant

`Pick`\<[`PuzzlerVariantDef`](../interfaces/PuzzlerVariantDef.md), `"stepLimit"`\> \| `null` \| `undefined`

The active variant, or null for the base level.

### steps

`number`

Tactics applied so far.

### solved

`boolean`

Whether the proof is complete.

## Returns

`boolean`

True when the run is over and must be reset.
