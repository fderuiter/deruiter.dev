[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / getArrivalGapScale

# Function: getArrivalGapScale()

> **getArrivalGapScale**(`timeSec`, `durationSec`, `windows?`): `number`

How much the arrival gap shrinks at a point in a shift: halved during a
rush, unchanged otherwise (#1938). A standard shift has one lunch rush; a
day of the week can have others (#2086).

## Parameters

### timeSec

`number`

Shift time of the arrival.

### durationSec

`number`

The shift's length.

### windows?

readonly [`RushWindow`](../../../types/type-aliases/RushWindow.md)[] = `...`

The shift's rushes; the standard lunch rush by default.

## Returns

`number`
