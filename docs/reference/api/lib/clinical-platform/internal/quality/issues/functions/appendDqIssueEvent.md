[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/issues](../README.md) / appendDqIssueEvent

# Function: appendDqIssueEvent()

> **appendDqIssueEvent**(`log`, `event`): readonly [`DqIssueEvent`](../../../../types/interfaces/DqIssueEvent.md)[]

The log with one more entry.

## Parameters

### log

readonly [`DqIssueEvent`](../../../../types/interfaces/DqIssueEvent.md)[]

### event

[`DqIssueEvent`](../../../../types/interfaces/DqIssueEvent.md)

## Returns

readonly [`DqIssueEvent`](../../../../types/interfaces/DqIssueEvent.md)[]

## Throws

Error when the entry would skip or repeat a step, predate the
  issue's previous entry, or open an issue without a known defect and
  the rules that caught it.
