[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / isShiftClockHalted

# Function: isShiftClockHalted()

> **isShiftClockHalted**(`pause`): `boolean`

Whether the shift clocks are held still (#1672): a player pause, the Field
Manual, a fix or signature dialog, or calibration each stop every subject
timer, the auditor patrol, the sponsor drift and the lifeline durations.

## Parameters

### pause

[`ShiftPauseState`](../interfaces/ShiftPauseState.md)

What is currently open or paused.

## Returns

`boolean`

True when the clocks must not advance.
