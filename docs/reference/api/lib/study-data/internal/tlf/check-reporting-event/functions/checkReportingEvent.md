[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/check-reporting-event](../README.md) / checkReportingEvent

# Function: checkReportingEvent()

> **checkReportingEvent**(`event`, `run`, `definition?`): [`Finding`](../../../../types/interfaces/Finding.md)[]

Checks an ARS reporting event against the run it reports on.

Every ADaM row must have its own id, every result's row-set references
must resolve to rows of the run's ADaM datasets, and a result must have rows behind it unless it is a count of
zero. With the study definition, the analyses are also evaluated again
from the ADaM datasets, and every result must come back with the same
value and the same rows, and no result may be missing from the event.

## Parameters

### event

[`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

The reporting event, as `buildTlfOutputs` returns it.

### run

[`PipelineRun`](../../../../types/interfaces/PipelineRun.md)

The run the event reports on.

### definition?

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

The study the run was made from; without it the
  results are not evaluated again.

## Returns

[`Finding`](../../../../types/interfaces/Finding.md)[]

One error finding per gap, in result order; none when every
  result resolves (and, with the definition, reproduces).
