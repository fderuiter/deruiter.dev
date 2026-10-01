[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / recordArcadeScore

# Function: recordArcadeScore()

> **recordArcadeScore**(`gameId`, `score`, `metadata?`): `object`

Core function to record an arcade score, update storage, evaluate achievements,
and dispatch typed event-bus events.

## Parameters

### gameId

`string`

### score

`number`

### metadata?

`Record`\<`string`, `unknown`\>

## Returns

`object`

### newlyUnlocked

> **newlyUnlocked**: [`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]

### progress

> **progress**: [`ArcadeProgress`](../interfaces/ArcadeProgress.md)
