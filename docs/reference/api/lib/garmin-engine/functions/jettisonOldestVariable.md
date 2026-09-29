[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / jettisonOldestVariable

# Function: jettisonOldestVariable()

> **jettisonOldestVariable**(`state`): `object`

Jettison (pop) the oldest collectible variable in the heap.
Required app state is never discarded; with nothing collectible the call is
a no-op that awards no score and reports a reason.

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

## Returns

`object`

### popped?

> `optional` **popped?**: [`MemoryVariable`](../interfaces/MemoryVariable.md)

### reason?

> `optional` **reason?**: `string`

### state

> **state**: [`GameEngineState`](../interfaces/GameEngineState.md)
