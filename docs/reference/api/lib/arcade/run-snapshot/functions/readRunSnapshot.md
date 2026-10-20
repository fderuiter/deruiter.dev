[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-snapshot](../README.md) / readRunSnapshot

# Function: readRunSnapshot()

> **readRunSnapshot**\<`State`\>(`storage`, `slug`, `format`): [`RunSnapshotRead`](../type-aliases/RunSnapshotRead.md)\<`State`\>

Reads a game's saved run. A save from another schema version, or one whose
envelope or state does not parse, is removed and reported as discarded.
This never throws, so a bad save can never break a view.

## Type Parameters

### State

`State`

## Parameters

### storage

[`RunSnapshotStorage`](../type-aliases/RunSnapshotStorage.md) \| `null`

Where the run is saved, or null for none.

### slug

`string`

The game's id.

### format

[`RunSnapshotFormat`](../interfaces/RunSnapshotFormat.md)\<`State`\>

The schema version and the state's Zod schema.

## Returns

[`RunSnapshotRead`](../type-aliases/RunSnapshotRead.md)\<`State`\>

The run, nothing, or why the save was discarded.
