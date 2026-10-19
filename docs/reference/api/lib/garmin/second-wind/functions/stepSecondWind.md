[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/second-wind](../README.md) / stepSecondWind

# Function: stepSecondWind()

> **stepSecondWind**(`wind`, `tick`): `object`

Advances an event by one tick. Returns the event (null once its time is
up), whether its goal was met on this tick, and whether it ended.

## Parameters

### wind

[`SecondWind`](../interfaces/SecondWind.md)

### tick

[`SecondWindTick`](../interfaces/SecondWindTick.md)

## Returns

`object`

### ended

> **ended**: `boolean`

### goalMet

> **goalMet**: `boolean`

### wind

> **wind**: [`SecondWind`](../interfaces/SecondWind.md) \| `null`
