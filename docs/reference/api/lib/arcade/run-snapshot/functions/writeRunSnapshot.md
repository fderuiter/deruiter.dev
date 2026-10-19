[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-snapshot](../README.md) / writeRunSnapshot

# Function: writeRunSnapshot()

> **writeRunSnapshot**\<`State`\>(`storage`, `slug`, `snapshot`): `boolean`

Saves a run. A full or blocked storage is not an error: the run is simply
not saved.

## Type Parameters

### State

`State`

## Parameters

### storage

[`RunSnapshotStorage`](../type-aliases/RunSnapshotStorage.md) \| `null`

Where to save, or null to skip.

### slug

`string`

The game's id.

### snapshot

[`RunSnapshot`](../interfaces/RunSnapshot.md)\<`State`\>

The run to save.

## Returns

`boolean`

Whether the run was saved.
