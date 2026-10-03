[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/graph](../README.md) / validateGraph

# Function: validateGraph()

> **validateGraph**(`graph`, `options?`): [`GraphValidationResult`](../../../types/interfaces/GraphValidationResult.md)

Validates topology: one source and sink, an extractor and a pivot, type-safe
wires, every extracted observation handle mapped to a pivot, no cycles, and
chips inside their lanes (clamped, with a warning).

## Parameters

### graph

[`PipelineGraph`](../../../types/interfaces/PipelineGraph.md)

### options?

[`ValidationOptions`](../interfaces/ValidationOptions.md) = `...`

## Returns

[`GraphValidationResult`](../../../types/interfaces/GraphValidationResult.md)
