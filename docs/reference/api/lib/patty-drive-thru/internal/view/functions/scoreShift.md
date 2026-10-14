[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/view](../README.md) / scoreShift

# Function: scoreShift()

> **scoreShift**(`state`): `number`

The arcade score for a shift: the total of `getShiftScoreBreakdown`, which
rewards cars served, speed, clean orders and the Dignity kept to close, and
docks late cars. Never negative.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

`number`
