[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / planRoute

# Function: planRoute()

> **planRoute**(`library`): [`RoutePlan`](../interfaces/RoutePlan.md)

Splits a room library into the start room, the middle pool and the bosses.

## Parameters

### library

readonly [`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

The rooms a run draws from, in their baseline order.

## Returns

[`RoutePlan`](../interfaces/RoutePlan.md)

The plan every route over this library follows.
