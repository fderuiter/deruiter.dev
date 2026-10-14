[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / mergeLevelScore

# Function: mergeLevelScore()

> **mergeLevelScore**(`existing`, `incoming`): [`LevelScore`](../../types/interfaces/LevelScore.md)

Decide which score a level keeps after a run finishes.

Ordering, strongest first: an honest proof always beats a `sorry`
admission; then more stars; then more remaining RAM; then the score
already saved (an equal replay never rewrites history). A `sorry` run
therefore never upgrades or erases an honest score.

The Golfed badge is kept apart from that ordering: once either score
earned it honestly, the kept score carries it, so a later run with more
stars but more steps does not take the badge away.

## Parameters

### existing

[`LevelScore`](../../types/interfaces/LevelScore.md) \| `undefined`

The score currently saved for the level, if any.

### incoming

[`LevelScore`](../../types/interfaces/LevelScore.md)

The score of the run that just finished.

## Returns

[`LevelScore`](../../types/interfaces/LevelScore.md)

The score the campaign should retain.
