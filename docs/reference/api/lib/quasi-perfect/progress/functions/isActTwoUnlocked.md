[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / isActTwoUnlocked

# Function: isActTwoUnlocked()

> **isActTwoUnlocked**(`progress`): `boolean`

Whether Act 2 is open: the Act 1 capstone has been proved without
`sorry`, or the save already records chapter 4 as unlocked. A save from
before Act 2 existed needs no migration; its capstone score decides.

## Parameters

### progress

`Pick`\<[`GameProgressState`](../../types/interfaces/GameProgressState.md), `"completedLevels"` \| `"unlockedChapter"`\> \| `null` \| `undefined`

Parsed campaign progress.

## Returns

`boolean`

True once Act 2 can be played.
