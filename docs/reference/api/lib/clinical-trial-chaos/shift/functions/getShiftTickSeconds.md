[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getShiftTickSeconds

# Function: getShiftTickSeconds()

> **getShiftTickSeconds**(`elapsedMs`, `halted`): `number`

Seconds a frame advances the shift clocks: none while halted, otherwise
the elapsed time clamped to `MAX_SHIFT_TICK_MS`.

## Parameters

### elapsedMs

`number`

Milliseconds since the previous frame.

### halted

`boolean`

Whether the clocks are held still.

## Returns

`number`

Seconds to pass to `tickShiftClocks`.
