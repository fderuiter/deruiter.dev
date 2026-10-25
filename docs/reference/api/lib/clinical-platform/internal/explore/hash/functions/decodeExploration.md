[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/hash](../README.md) / decodeExploration

# Function: decodeExploration()

> **decodeExploration**(`hash`, `metrics?`): [`ExplorationDecoding`](../../../../types/explore/type-aliases/ExplorationDecoding.md)

Reads an exploration from a URL hash, with or without the leading `#`.

## Parameters

### hash

`string`

The hash.

### metrics?

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ExplorationDecoding`](../../../../types/explore/type-aliases/ExplorationDecoding.md)

The normalized exploration, or why the hash cannot be read.
