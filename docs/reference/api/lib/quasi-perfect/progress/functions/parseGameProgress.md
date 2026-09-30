[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / parseGameProgress

# Function: parseGameProgress()

> **parseGameProgress**(`raw`): [`GameProgressState`](../../types/interfaces/GameProgressState.md)

Parse stored campaign progress without throwing. Malformed JSON, a
non-object value or a non-object `completedLevels` all become empty
progress. `currentLevelIndex` is passed through as stored, so
`resolveResumeLevelIndex` can tell a missing index from a corrupt one.

## Parameters

### raw

`string` \| `null`

The stored string, or null when nothing is stored.

## Returns

[`GameProgressState`](../../types/interfaces/GameProgressState.md)

Progress that is safe to read and to spread into a new save.
