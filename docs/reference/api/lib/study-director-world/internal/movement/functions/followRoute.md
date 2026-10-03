[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/movement](../README.md) / followRoute

# Function: followRoute()

> **followRoute**(`world`, `route`, `map?`, `people?`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `walkedSteps`: `number`; \}\>

Walks a planned route one step at a time, then turns to face the target.
Stops early, with what it managed, if a step is refused (too late or too
tired); `walkedSteps` says how far it got.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### route

[`Route`](../../../types/interfaces/Route.md)

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### people?

readonly [`TilePoint`](../../../types/interfaces/TilePoint.md)[] = `[]`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `walkedSteps`: `number`; \}\>
