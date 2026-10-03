[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/interact](../README.md) / describeSurroundings

# Function: describeSurroundings()

> **describeSurroundings**(`world`, `map?`, `people?`, `conditions?`): `string`

A text description of the player's surroundings, for the canvas's
accessible name and the room panel: the room, who is in it, the stations
in it, and what the player is facing. Room conditions add a line when a
room is anything but tidy.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### people?

readonly [`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[] = `[]`

### conditions?

`Partial`\<`Record`\<[`RoomId`](../../../types/type-aliases/RoomId.md), [`RoomCondition`](../../../types/interfaces/RoomCondition.md)\>\> = `{}`

## Returns

`string`
