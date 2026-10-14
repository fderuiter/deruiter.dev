[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-ghost](../README.md) / recordGhost

# Function: recordGhost()

> **recordGhost**(`recorder`, `state`, `swimming`): `void`

Records `state` when its run clock has reached the next sample time. Call
it after every simulation step: a step is shorter than a sample, so each
sample is taken within one step of its time. `swimming` is whether the
runner is drawn swimming. Does nothing outside play.

## Parameters

### recorder

[`GhostRecorder`](../interfaces/GhostRecorder.md)

### state

[`GhostSource`](../interfaces/GhostSource.md)

### swimming

`boolean`

## Returns

`void`
