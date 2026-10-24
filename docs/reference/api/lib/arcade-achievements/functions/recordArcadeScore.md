[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / recordArcadeScore

# Function: recordArcadeScore()

> **recordArcadeScore**(`gameId`, `score`, `metadata?`, `tags?`): `object`

Core function to record an arcade score, update storage, evaluate achievements,
and dispatch typed event-bus events.

## Parameters

### gameId

`string`

The game's id.

### score

`number`

The run's score.

### metadata?

`Record`\<`string`, `unknown`\>

Extra detail for the `arcade_score_updated` event.

### tags?

[`RunTags`](../../arcade/run-tags/interfaces/RunTags.md)

How the run was played (#2547), kept with a new best so
  score lists and gates can tell an assisted best from an unassisted one.

## Returns

`object`

The saved progress and the trophies this score unlocked.

### newlyUnlocked

> **newlyUnlocked**: [`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]

### progress

> **progress**: [`ArcadeProgress`](../../arcade/progress/core/interfaces/ArcadeProgress.md)
