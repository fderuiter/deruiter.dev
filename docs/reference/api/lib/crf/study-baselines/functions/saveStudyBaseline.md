[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/study-baselines](../README.md) / saveStudyBaseline

# Function: saveStudyBaseline()

> **saveStudyBaseline**(`study`, `options`, `storage?`): [`SaveStudyBaselineResult`](../type-aliases/SaveStudyBaselineResult.md)

Persists an immutable, version-tagged study baseline snapshot.
Deep-clones the study snapshot so subsequent mutations to the working draft
cannot alter the historical baseline.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

### options

[`SaveStudyBaselineOptions`](../interfaces/SaveStudyBaselineOptions.md)

### storage?

[`RawStorage`](../../../safe-storage/type-aliases/RawStorage.md)

## Returns

[`SaveStudyBaselineResult`](../type-aliases/SaveStudyBaselineResult.md)
