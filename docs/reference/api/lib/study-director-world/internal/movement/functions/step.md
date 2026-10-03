[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/movement](../README.md) / step

# Function: step()

> **step**(`world`, `facing`, `map?`, `people?`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `moved`: `boolean`; \}\>

One press of an arrow key. The player turns to face the direction and, if
the tile there is free, steps onto it. A step costs a quarter of a clock
minute (fractional, so short walks are not rounded up), every fortieth
tile of the day costs a point of energy, and steps after the office day
are overtime. Turning into a wall or a person costs nothing.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### facing

`"up"` \| `"down"` \| `"left"` \| `"right"`

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### people?

readonly [`TilePoint`](../../../types/interfaces/TilePoint.md)[] = `[]`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `moved`: `boolean`; \}\>
