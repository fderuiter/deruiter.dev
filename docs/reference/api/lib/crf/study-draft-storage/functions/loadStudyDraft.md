[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-draft-storage](../README.md) / loadStudyDraft

# Function: loadStudyDraft()

> **loadStudyDraft**(`storage?`): [`LoadStudyDraftResult`](../type-aliases/LoadStudyDraftResult.md)

Reads the acknowledged local draft, if any. A present-but-unreadable or
version-mismatched entry is copied to [STUDY\_DRAFT\_CORRUPT\_BACKUP\_KEY](../variables/STUDY_DRAFT_CORRUPT_BACKUP_KEY.md)
for manual recovery rather than being silently overwritten or discarded.

## Parameters

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`LoadStudyDraftResult`](../type-aliases/LoadStudyDraftResult.md)
