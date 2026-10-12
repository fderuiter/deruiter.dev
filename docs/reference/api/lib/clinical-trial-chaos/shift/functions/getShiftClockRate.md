[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getShiftClockRate

# Function: getShiftClockRate()

> **getShiftClockRate**(`pause`): `number`

How fast the shift clocks run in the live game (#1937): stopped for a
pause, the Field Manual or calibration, slowed to `DIALOG_CLOCK_RATE`
while a fix or signature dialog is open, so a decision still costs time,
and full speed otherwise.

## Parameters

### pause

[`ShiftPauseState`](../interfaces/ShiftPauseState.md)

What is currently open or paused.

## Returns

`number`

0, `DIALOG_CLOCK_RATE` or 1.
