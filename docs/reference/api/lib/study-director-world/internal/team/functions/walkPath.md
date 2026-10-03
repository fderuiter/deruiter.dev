[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/team](../README.md) / walkPath

# Function: walkPath()

> **walkPath**(`map`, `from`, `to`): [`TilePoint`](../../../types/interfaces/TilePoint.md)[]

The shortest walk between two tiles over free floor, ignoring people, as
the tiles stepped onto (the start excluded, the end included). Fixed
neighbour order keeps it deterministic. Empty when unreachable or equal.

## Parameters

### map

[`WorldMap`](../../../types/interfaces/WorldMap.md)

### from

[`TilePoint`](../../../types/interfaces/TilePoint.md)

### to

[`TilePoint`](../../../types/interfaces/TilePoint.md)

## Returns

[`TilePoint`](../../../types/interfaces/TilePoint.md)[]
