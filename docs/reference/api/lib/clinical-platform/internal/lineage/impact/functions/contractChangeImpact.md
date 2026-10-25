[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/lineage/impact](../README.md) / contractChangeImpact

# Function: contractChangeImpact()

> **contractChangeImpact**(`graph`, `previous`, `next`): [`ContractChangeImpact`](../../../../types/lineage/interfaces/ContractChangeImpact.md)

What a contract change reaches: every column it changes or removes, the
nodes downstream of them, and the roles to notify before the release. A
change to the product's service levels or retention reaches every column,
since every consumer relies on them; a column only added reaches nothing
yet, because nothing reads it.

## Parameters

### graph

[`PlatformLineage`](../../../../types/platform/interfaces/PlatformLineage.md)

A graph from `platformLineage`.

### previous

[`DataContract`](../../../../types/platform/interfaces/DataContract.md)

The release in force.

### next

[`DataContract`](../../../../types/platform/interfaces/DataContract.md)

The proposed release.

## Returns

[`ContractChangeImpact`](../../../../types/lineage/interfaces/ContractChangeImpact.md)

The impact; empty when nothing a consumer reads changed.

## Throws

Error when the two releases are of different products, or a
  changed column has no node in the graph.
