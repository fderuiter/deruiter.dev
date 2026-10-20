[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/splits](../README.md) / formatClock

# Function: formatClock()

> **formatClock**(`ms`): `string`

"m:ss.cc", e.g. 64380 becomes "1:04.38". Hours are shown as "h:mm:ss.cc" at
3,600,000 ms and over. Negative or non-finite values become "0:00.00".
Hundredths are truncated, never rounded up.

## Parameters

### ms

`number`

## Returns

`string`
