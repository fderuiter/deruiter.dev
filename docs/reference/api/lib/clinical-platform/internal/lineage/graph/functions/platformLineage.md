[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/lineage/graph](../README.md) / platformLineage

# Function: platformLineage()

> **platformLineage**(`run`, `reports`, `metrics?`): [`PlatformLineage`](../../../../types/platform/interfaces/PlatformLineage.md)

Builds the platform lineage graph.

## Parameters

### run

[`PipelineRun`](../../../../../study-data/types/interfaces/PipelineRun.md)

A Study Data Pipeline run, which supplies the variable
  metadata; the metadata does not depend on the seed or subject count.

### reports

readonly [`ReportSpec`](../../../../types/platform/interfaces/ReportSpec.md)[]

Report specs to include, for example `REPORT_PACK`
  and the operations dashboard's specs.

### metrics?

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

Metrics to include, usually `METRIC_REGISTRY`.

## Returns

[`PlatformLineage`](../../../../types/platform/interfaces/PlatformLineage.md)

Nodes in stage order then by id, and edges by target then source.

## Throws

Error when a pipeline variable names a source that does not exist.
