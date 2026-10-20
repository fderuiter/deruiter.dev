[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-snapshot](../README.md) / RunSnapshotRead

# Type Alias: RunSnapshotRead\<State\>

> **RunSnapshotRead**\<`State`\> = \{ `status`: `"empty"`; \} \| \{ `snapshot`: [`RunSnapshot`](../interfaces/RunSnapshot.md)\<`State`\>; `status`: `"ok"`; \} \| \{ `reason`: [`RunSnapshotDiscardReason`](RunSnapshotDiscardReason.md); `status`: `"discarded"`; \}

What [readRunSnapshot](../functions/readRunSnapshot.md) found.

## Type Parameters

### State

`State`
