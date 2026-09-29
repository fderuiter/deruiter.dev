[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / triggerGarbageCollection

# Function: triggerGarbageCollection()

> **triggerGarbageCollection**(`state`): `object`

Force Garbage Collection (GC)
Freezes game for 500ms and frees up to 2.0 to 4.0 KB of collectible garbage.
With no collectible garbage the call is a no-op: no freeze, no score.

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

## Returns

`object`

### freedKb

> **freedKb**: `number`

### reason?

> `optional` **reason?**: `string`

### state

> **state**: [`GameEngineState`](../interfaces/GameEngineState.md)
