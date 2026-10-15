[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / countHonestProofs

# Function: countHonestProofs()

> **countHonestProofs**(`progress`): `number`

How many levels the save records as proved honestly: completed with at
least one star and no `sorry`. A level admitted with `sorry` is not a
proof, so it never counts (#1939, #2198).

## Parameters

### progress

`Pick`\<[`GameProgressState`](../../types/interfaces/GameProgressState.md), `"completedLevels"`\> \| `null` \| `undefined`

Parsed campaign progress.

## Returns

`number`

The number of honestly proved levels.
