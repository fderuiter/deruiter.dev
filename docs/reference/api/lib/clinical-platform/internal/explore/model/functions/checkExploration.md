[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/model](../README.md) / checkExploration

# Function: checkExploration()

> **checkExploration**(`exploration`, `metrics?`): [`ExplorationFinding`](../../../../types/interfaces/ExplorationFinding.md)[]

Checks an exploration: the metric is offered, the grouping and filters
are ones the semantic layer allows, and the chosen visual fits the
grouping.

## Parameters

### exploration

[`Exploration`](../../../../types/interfaces/Exploration.md)

The exploration.

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ExplorationFinding`](../../../../types/interfaces/ExplorationFinding.md)[]

One finding per problem; empty when the exploration can run.
