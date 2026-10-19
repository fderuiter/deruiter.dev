[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/splits](../README.md) / splitToast

# Function: splitToast()

> **splitToast**(`splits`): `string` \| `null`

The toast for the lap just recorded (the last element of splits):
"WORLD RECORD PACE" when it is under WORLD_RECORD_SPLIT_MS. Otherwise, with
a previous lap, "NEGATIVE SPLIT" when it is faster than that lap, or
"POSITIVE SPLIT · EASE UP" when it is more than 5% slower. Anything else,
including an empty list, gives null.

## Parameters

### splits

readonly `number`[]

## Returns

`string` \| `null`
