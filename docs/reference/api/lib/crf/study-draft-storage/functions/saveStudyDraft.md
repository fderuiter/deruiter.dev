[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-draft-storage](../README.md) / saveStudyDraft

# Function: saveStudyDraft()

> **saveStudyDraft**(`study`, `storage?`): [`SaveStudyDraftResult`](../type-aliases/SaveStudyDraftResult.md)

Persists the current study as the acknowledged local draft. Never throws;
a full or unavailable store reports `"error"`/`"unavailable"` so the caller
can keep the in-memory draft and offer a native download instead.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`SaveStudyDraftResult`](../type-aliases/SaveStudyDraftResult.md)
