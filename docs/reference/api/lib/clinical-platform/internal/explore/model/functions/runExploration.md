[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/model](../README.md) / runExploration

# Function: runExploration()

> **runExploration**(`warehouse`, `exploration`, `metrics?`): [`ExplorationResult`](../../../../types/interfaces/ExplorationResult.md)

Runs an exploration over one warehouse: builds its exploratory report
spec, suggests a visual from the result's shape, and draws it with the
chosen visual or else the suggested one.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

The warehouse to explore.

### exploration

[`Exploration`](../../../../types/interfaces/Exploration.md)

The exploration.

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ExplorationResult`](../../../../types/interfaces/ExplorationResult.md)

The result.

## Throws

Error when `checkExploration` finds a problem, naming each one.
