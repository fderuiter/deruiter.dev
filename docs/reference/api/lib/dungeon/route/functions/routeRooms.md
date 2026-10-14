[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / routeRooms

# Function: routeRooms()

> **routeRooms**(`library`, `route`): [`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

The rooms of a route, numbered by their one-based position in the run.

## Parameters

### library

readonly [`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

The room library.

### route

[`RunRoute`](../interfaces/RunRoute.md)

The route.

## Returns

[`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

One room per step taken, in play order.
