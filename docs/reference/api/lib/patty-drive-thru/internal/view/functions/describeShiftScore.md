[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/view](../README.md) / describeShiftScore

# Function: describeShiftScore()

> **describeShiftScore**(`state`): `string`

How a shift's score adds up, in one line for the end card (#1938, #2057),
for example "16 cars x 10 - 2 late x 5 + 9 fast x 5 + 48 streak + 50 for
closing + 72 Dignity". The closing and Dignity parts appear only when the
shift reached close.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

`string`
