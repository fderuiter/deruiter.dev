[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/study-baselines](../README.md) / RestoreStudyBaselineResult

# Type Alias: RestoreStudyBaselineResult

> **RestoreStudyBaselineResult** = \{ `baseline`: [`StudyBaseline`](../../../types/interfaces/StudyBaseline.md); `provenanceNote`: `string`; `status`: `"restored"`; `study`: [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md); \} \| \{ `message`: `string`; `status`: `"not_found"`; \} \| \{ `message`: `string`; `status`: `"error"`; \}
