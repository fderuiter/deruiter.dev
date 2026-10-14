[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-race-store](../README.md) / raceOverText

# Function: raceOverText()

> **raceOverText**(`verdict`, `outcome`, `place`, `record`): `string`

The announcement that ends a race: its time or DNF / DNQ, and the place.
e.g. "Race over: 4:12.33, place 1 on this board, course record."

## Parameters

### verdict

[`RaceVerdict`](../../garmin-race/interfaces/RaceVerdict.md)

### outcome

[`RaceOutcome`](../../garmin-race/interfaces/RaceOutcome.md)

### place

`number`

### record

`"CR"` \| `"PR"` \| `null`

## Returns

`string`
