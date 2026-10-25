[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / PlatformLineage

# Interface: PlatformLineage

Column-level lineage from collected values to reports, as one graph (#2637).

## Properties

### edges

> `readonly` **edges**: readonly [`LineageGraphEdge`](LineageGraphEdge.md)[]

Edges sorted by target, then source.

***

### nodes

> `readonly` **nodes**: readonly [`LineageNode`](LineageNode.md)[]

Nodes in stage order, then by id.
