[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/model](../README.md) / startExploration

# Function: startExploration()

> **startExploration**(`metricId`, `metrics?`): [`Exploration`](../../../../types/explore/interfaces/Exploration.md)

The exploration a metric starts from: one total, or, for a metric defined
per study, grouped by study.

## Parameters

### metricId

`string`

Registry metric id.

### metrics?

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`Exploration`](../../../../types/explore/interfaces/Exploration.md)

The exploration.

## Throws

Error when the explorer does not offer the metric.
