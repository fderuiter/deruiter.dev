[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-draft-storage](../README.md) / saveStudySnapshot

# Function: saveStudySnapshot()

> **saveStudySnapshot**(`study`, `label?`, `storage?`): [`SaveStudySnapshotResult`](../type-aliases/SaveStudySnapshotResult.md)

Persists a labeled snapshot of the current study into snapshot storage.
Retains the 20 most recent snapshots to prevent storage exhaustion.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### label?

`string`

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`SaveStudySnapshotResult`](../type-aliases/SaveStudySnapshotResult.md)
