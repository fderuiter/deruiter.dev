[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / routeTierOf

# Function: routeTierOf()

> **routeTierOf**(`room`): [`RouteTier`](../type-aliases/RouteTier.md)

The route tier of a room. A room with a boss is a boss room whatever its
id; an unknown id counts as a middle room.

## Parameters

### room

`Pick`\<[`DungeonRoom`](../../types/interfaces/DungeonRoom.md), `"id"` \| `"boss"`\>

The room, or its id and boss.

## Returns

[`RouteTier`](../type-aliases/RouteTier.md)

The room's tier.
