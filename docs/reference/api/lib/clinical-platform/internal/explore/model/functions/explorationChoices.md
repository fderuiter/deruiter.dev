[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/model](../README.md) / explorationChoices

# Function: explorationChoices()

> **explorationChoices**(`exploration`, `metrics?`): [`ExplorationChoices`](../../../../types/interfaces/ExplorationChoices.md)

What can change in an exploration next without breaking it: each
dimension that can be added or removed, each dimension the metric may be
filtered by, and each visual that fits the grouping.

## Parameters

### exploration

[`Exploration`](../../../../types/interfaces/Exploration.md)

The exploration.

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ExplorationChoices`](../../../../types/interfaces/ExplorationChoices.md)

The choices; all empty when the explorer does not offer the metric.
