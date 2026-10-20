[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/ghost](../README.md) / ghostGapMs

# Function: ghostGapMs()

> **ghostGapMs**(`track`, `progressMeters`, `clockMs`): `number` \| `null`

The run-clock gap to the ghost, in ms: positive when the runner is behind
(the ghost reached `progressMeters` that long before `clockMs`), negative
when ahead. `progressMeters` is the furthest distance the runner has
reached. Null when the ghost never got that far.

## Parameters

### track

[`GhostTrack`](../interfaces/GhostTrack.md)

### progressMeters

`number`

### clockMs

`number`

## Returns

`number` \| `null`
