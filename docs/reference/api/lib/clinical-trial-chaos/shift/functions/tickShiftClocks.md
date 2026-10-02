[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / tickShiftClocks

# Function: tickShiftClocks()

> **tickShiftClocks**(`clocks`, `deltaSeconds`, `auditorPacingMultiplier?`): [`ShiftClockTick`](../interfaces/ShiftClockTick.md)

Advances the deterministic per-frame clocks by one step, in order: subject
deadlines (expiries raise suspicion and break the combo), the auditor
patrol, lifeline durations (the coffee break ending), and the running
protocol amendment. Spawning, random amendments and the sponsor inbox draw
on randomness and stay with the caller.

## Parameters

### clocks

[`ShiftClocks`](../interfaces/ShiftClocks.md)

The state before the frame.

### deltaSeconds

`number`

Seconds to advance; 0 while a dialog pauses play.

### auditorPacingMultiplier?

`number` = `1.0`

## Returns

[`ShiftClockTick`](../interfaces/ShiftClockTick.md)

The state after the frame and what happened.
