[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / getShiftRamp

# Function: getShiftRamp()

> **getShiftRamp**(`timeSec`, `durationSec`): `number`

How much the shift ramp has shrunk the arrival gap by this point (#2138):
1 at clock-in, falling steadily to `1 - SHIFT_RAMP` at close.

## Parameters

### timeSec

`number`

Shift time of the arrival.

### durationSec

`number`

The shift's length.

## Returns

`number`
