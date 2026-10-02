[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getViolationBreakdown

# Function: getViolationBreakdown()

> **getViolationBreakdown**(`score`, `wrongFixes`): [`ViolationBreakdown`](../interfaces/ViolationBreakdown.md)

Splits a run's violations by kind (#1670). Audit violations hold both the
expiries and the station rejections; wrong fixes are recorded separately.

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state to break down.

### wrongFixes

`number`

Rule violations recorded for wrong fixes.

## Returns

[`ViolationBreakdown`](../interfaces/ViolationBreakdown.md)

The counts by kind and their total.
