[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / chooseRouteRoom

# Function: chooseRouteRoom()

> **chooseRouteRoom**(`library`, `route`, `choice`): [`RunRoute`](../interfaces/RunRoute.md)

Moves the route on to the chosen room.

## Parameters

### library

readonly [`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

The room library.

### route

[`RunRoute`](../interfaces/RunRoute.md)

The route so far.

### choice

`number`

The library position of the chosen room.

## Returns

[`RunRoute`](../interfaces/RunRoute.md)

The route with the chosen room as its current room.

## Throws

RangeError when the choice is not one of the offered rooms.
