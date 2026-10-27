[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useStudyAutosave](../README.md) / useStudyAutosave

# Function: useStudyAutosave()

> **useStudyAutosave**(`study`): [`UseStudyAutosaveResult`](../interfaces/UseStudyAutosaveResult.md)

Debounces writes of `study` to the acknowledged local draft (see
lib/crf/internal/study-draft-storage.ts) and exposes a saving/saved/error status so
the studio can show whether the author's latest change is safely stored.

## Parameters

### study

[`StudyProtocol`](../../../lib/crf/types/interfaces/StudyProtocol.md)

## Returns

[`UseStudyAutosaveResult`](../interfaces/UseStudyAutosaveResult.md)
