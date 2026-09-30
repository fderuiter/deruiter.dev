[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / breakCombo

# Function: breakCombo()

> **breakCombo**(`score`, `violations?`): [`GameScoreState`](../../types/interfaces/GameScoreState.md)

Breaks the combo after a rejected or expired CRF: the combo and multiplier
reset and each failure counts as an audit violation.

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state before the failure.

### violations?

`number` = `1`

Audit violations to record.

## Returns

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The updated score state.
