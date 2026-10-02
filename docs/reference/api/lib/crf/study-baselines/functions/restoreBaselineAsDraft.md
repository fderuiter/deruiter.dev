[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-baselines](../README.md) / restoreBaselineAsDraft

# Function: restoreBaselineAsDraft()

> **restoreBaselineAsDraft**(`baselineOrId`, `options?`, `storage?`): [`RestoreStudyBaselineResult`](../type-aliases/RestoreStudyBaselineResult.md)

Restores an immutable baseline snapshot into a fresh working draft.
The original baseline snapshot in storage is kept 100% intact and untouched.
The restored study receives clear provenance metadata documenting its origin.

## Parameters

### baselineOrId

`string` \| [`StudyBaseline`](../../types/interfaces/StudyBaseline.md)

### options?

[`RestoreStudyBaselineOptions`](../interfaces/RestoreStudyBaselineOptions.md)

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`RestoreStudyBaselineResult`](../type-aliases/RestoreStudyBaselineResult.md)
