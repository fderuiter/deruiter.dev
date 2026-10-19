[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/ghost](../README.md) / ghostAt

# Function: ghostAt()

> **ghostAt**(`track`, `clockMs`): [`GhostSample`](../interfaces/GhostSample.md) \| `null`

The ghost at run clock `clockMs`: distance and height eased between the two
samples around it, and the stage, power and pose of the earlier one. Null
before the start or after the ghost's finish, when it is no longer drawn.

## Parameters

### track

[`GhostTrack`](../interfaces/GhostTrack.md)

### clockMs

`number`

## Returns

[`GhostSample`](../interfaces/GhostSample.md) \| `null`
