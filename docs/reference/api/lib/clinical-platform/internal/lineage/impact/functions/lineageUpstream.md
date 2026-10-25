[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/lineage/impact](../README.md) / lineageUpstream

# Function: lineageUpstream()

> **lineageUpstream**(`graph`, `id`): [`LineageReach`](../../../../types/lineage/interfaces/LineageReach.md)[]

Everything a node is computed from, nearest first.

## Parameters

### graph

[`PlatformLineage`](../../../../types/platform/interfaces/PlatformLineage.md)

### id

`string`

## Returns

[`LineageReach`](../../../../types/lineage/interfaces/LineageReach.md)[]

## Throws

Error when the graph has no node with the id.
