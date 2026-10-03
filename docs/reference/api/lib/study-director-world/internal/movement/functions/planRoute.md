[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/movement](../README.md) / planRoute

# Function: planRoute()

> **planRoute**(`from`, `target`, `map?`, `people?`): [`Route`](../../../types/interfaces/Route.md) \| `null`

Plans the shortest walk to a directory target with a breadth-first search
over free tiles, and the facing that looks at it on arrival. People block
the way. Returns null when no free tile next to the target can be reached.

## Parameters

### from

[`TilePoint`](../../../types/interfaces/TilePoint.md) & `object`

### target

[`DirectoryTarget`](../../../types/type-aliases/DirectoryTarget.md)

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### people?

readonly [`TilePoint`](../../../types/interfaces/TilePoint.md)[] = `[]`

## Returns

[`Route`](../../../types/interfaces/Route.md) \| `null`
