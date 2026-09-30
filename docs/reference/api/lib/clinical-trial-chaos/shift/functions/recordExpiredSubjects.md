[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / recordExpiredSubjects

# Function: recordExpiredSubjects()

> **recordExpiredSubjects**(`score`, `count`): [`GameScoreState`](../../types/interfaces/GameScoreState.md)

Records subjects that expired on the conveyor: the combo breaks, each
expiry counts as an audit violation, and the expired tally grows so the
report can name them as expiries rather than bad submissions (#1670).

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state before the expiries.

### count

`number`

Subjects that expired.

## Returns

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The updated score state.
