[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / isLevelLocked

# Function: isLevelLocked()

> **isLevelLocked**(`progress`, `level`): `boolean`

Whether a level is still locked. Only Act 2 levels lock; every Act 1 level
is open from the start, as it always was.

## Parameters

### progress

`Pick`\<[`GameProgressState`](../../types/interfaces/GameProgressState.md), `"completedLevels"` \| `"unlockedChapter"`\> \| `null` \| `undefined`

Parsed campaign progress.

### level

`Pick`\<[`PuzzlerLevelDef`](../../types/interfaces/PuzzlerLevelDef.md), `"chapter"`\>

The level, or anything carrying its chapter.

## Returns

`boolean`

True when the level cannot be played yet.
