[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/schedule-ops](../README.md) / ScheduleOpResult

# Type Alias: ScheduleOpResult

> **ScheduleOpResult** = \{ `ok`: `true`; `study`: [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md); `visit`: [`StudyVisit`](../../../types/interfaces/StudyVisit.md); \} \| \{ `error`: `string`; `ok`: `false`; \}

The outcome of a schedule operation: the new study, or why it was refused.
