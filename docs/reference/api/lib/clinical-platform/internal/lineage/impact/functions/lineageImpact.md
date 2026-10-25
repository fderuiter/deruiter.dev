[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/lineage/impact](../README.md) / lineageImpact

# Function: lineageImpact()

> **lineageImpact**(`graph`, `origin`): [`LineageImpact`](../../../../types/interfaces/LineageImpact.md)

Everything a change to one node reaches, and the roles accountable for
it, so a contract or metric change names who to notify.

## Parameters

### graph

[`PlatformLineage`](../../../../types/interfaces/PlatformLineage.md)

### origin

`string`

## Returns

[`LineageImpact`](../../../../types/interfaces/LineageImpact.md)

## Throws

Error when the graph has no node with the id.
