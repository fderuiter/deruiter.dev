[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/lineage/impact](../README.md) / checkLineage

# Function: checkLineage()

> **checkLineage**(`graph`): [`LineageFinding`](../../../../types/lineage/interfaces/LineageFinding.md)[]

Checks the rules a lineage graph keeps: no duplicate nodes, no edge to or
from a missing node, no cycle, every metric reaching a source
system (a bronze feed or a collected study variable), and every report
showing at least one metric.

## Parameters

### graph

[`PlatformLineage`](../../../../types/platform/interfaces/PlatformLineage.md)

## Returns

[`LineageFinding`](../../../../types/lineage/interfaces/LineageFinding.md)[]

The broken rules; empty when the graph is sound.
