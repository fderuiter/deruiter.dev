[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/view](../README.md) / getShiftScoreBreakdown

# Function: getShiftScoreBreakdown()

> **getShiftScoreBreakdown**(`state`): [`ShiftScoreBreakdown`](../../../types/interfaces/ShiftScoreBreakdown.md)

How a shift's score is made up (#2057): points per car served, a deduction
per late car, a bonus per order bumped while still green, the points the
clean-order streak earned, and, only for a shift that reaches close, the
closing bonus plus a bonus for the Dignity still standing. Every part is
read from the shift's tallies and meters, so the same shift always scores
the same.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

[`ShiftScoreBreakdown`](../../../types/interfaces/ShiftScoreBreakdown.md)
