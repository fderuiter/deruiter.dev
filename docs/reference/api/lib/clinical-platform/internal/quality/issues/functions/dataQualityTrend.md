[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/issues](../README.md) / dataQualityTrend

# Function: dataQualityTrend()

> **dataQualityTrend**(`warehouse`, `run`, `log`, `weeks?`): [`DqTrendPoint`](../../../../types/interfaces/DqTrendPoint.md)[]

The scorecard at the end of each of the weeks up to the data cut.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

### run

[`PipelineRun`](../../../../../study-data/types/interfaces/PipelineRun.md)

### log

readonly [`DqIssueEvent`](../../../../types/interfaces/DqIssueEvent.md)[]

### weeks?

`number` = `12`

Weeks to cover, from 1 to 52; the last ends on the cut.

## Returns

[`DqTrendPoint`](../../../../types/interfaces/DqTrendPoint.md)[]

## Throws

Error when `weeks` is out of range or the log runs past the cut.
