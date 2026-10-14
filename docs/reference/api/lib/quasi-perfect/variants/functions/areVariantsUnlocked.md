[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / areVariantsUnlocked

# Function: areVariantsUnlocked()

> **areVariantsUnlocked**(`progress`, `levelId`): `boolean`

Whether a level's variants are open: the base level has been proved
honestly, with no `sorry`.

## Parameters

### progress

`Pick`\<[`GameProgressState`](../../types/interfaces/GameProgressState.md), `"completedLevels"`\> \| `null` \| `undefined`

Parsed campaign progress.

### levelId

`string` \| `number`

The level's id.

## Returns

`boolean`

True once the base level has an honest clear.
