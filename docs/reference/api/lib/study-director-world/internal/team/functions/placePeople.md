[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/team](../README.md) / placePeople

# Function: placePeople()

> **placePeople**(`world`, `map?`): [`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[]

Everyone on the floor right now, from their schedules (nobody, on a map
other than the CRO floor): the people list the
renderer, movement, interaction and directory take. People in a meeting
sit at the conference table instead. Two people walking can share a tile
for a moment; anyone standing still has their own.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

## Returns

[`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[]
