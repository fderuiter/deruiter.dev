[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/internal/policy](../README.md) / checkLayerFlow

# Function: checkLayerFlow()

> **checkLayerFlow**(`edge`): [`PolicyFinding`](../../../types/interfaces/PolicyFinding.md) \| `null`

Checks that a lineage edge flows towards gold. Bronze feeds silver and
gold, silver feeds silver and gold, and gold never writes back into a
lower layer.

## Parameters

### edge

[`LineageEdge`](../../../types/interfaces/LineageEdge.md)

Column-level lineage edge.

## Returns

[`PolicyFinding`](../../../types/interfaces/PolicyFinding.md) \| `null`

A finding when the edge flows backwards, otherwise `null`.
