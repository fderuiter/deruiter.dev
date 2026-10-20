[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/splits](../README.md) / mergeBests

# Function: mergeBests()

> **mergeBests**(`bests`, `splits`, `totalMs`, `finished`): [`GarminBests`](../interfaces/GarminBests.md)

Merges a run into the bests and returns a new object. Each lap's split
replaces that lap's best when faster, or fills the lap when it has no best
yet, in order, so a lap can only be filled after the laps before it. The
total replaces the best total only when the run is finished and the total
is faster or there is none. Non-finite or non-positive inputs are ignored.

## Parameters

### bests

[`GarminBests`](../interfaces/GarminBests.md)

### splits

readonly `number`[]

### totalMs

`number`

### finished

`boolean`

## Returns

[`GarminBests`](../interfaces/GarminBests.md)
