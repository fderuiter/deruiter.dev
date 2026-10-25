[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/model](../README.md) / explorationSpec

# Function: explorationSpec()

> **explorationSpec**(`exploration`, `visual`, `metrics?`): [`ReportSpec`](../../../../types/platform/interfaces/ReportSpec.md)

The exploratory report spec an exploration builds. Nobody owns or has
reviewed it, and the spec says so; `promotionSteps` lists what a person
has to do before it can become a managed or certified report.

## Parameters

### exploration

[`Exploration`](../../../../types/explore/interfaces/Exploration.md)

The exploration.

### visual

[`ReportVisual`](../../../../types/platform/type-aliases/ReportVisual.md)

The visual to draw it with.

### metrics?

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ReportSpec`](../../../../types/platform/interfaces/ReportSpec.md)

The spec.

## Throws

Error when the explorer does not offer the metric.
