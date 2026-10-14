[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / parseGameProgress

# Function: parseGameProgress()

> **parseGameProgress**(`raw`): [`GameProgressState`](../../types/interfaces/GameProgressState.md)

Parse stored campaign progress without throwing. Malformed JSON, a
non-object value or a non-object `completedLevels` all become empty
progress. A level's `golfed` or `steps` field of the wrong type is
dropped, so a save written before the Golfed badge (#2059) loads as it
did and simply has no badges. `clearedVariants` is cleaned the same way:
a save from before variants (#2090) reads as none cleared. `currentLevelIndex` is passed through as stored, so
`resolveResumeLevelIndex` can tell a missing index from a corrupt one.

## Parameters

### raw

`string` \| `null`

The stored string, or null when nothing is stored.

## Returns

[`GameProgressState`](../../types/interfaces/GameProgressState.md)

Progress that is safe to read and to spread into a new save.
