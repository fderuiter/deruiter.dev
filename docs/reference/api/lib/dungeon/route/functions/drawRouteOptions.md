[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / drawRouteOptions

# Function: drawRouteOptions()

> **drawRouteOptions**(`library`, `route`): `number`[]

The rooms offered as the next step of a run, as library positions in
library order. Middle steps offer two rooms where there are two to offer;
the first middle step pairs an opening room with a middle room and keeps
the rest stop back, so the run ramps up. Boss steps offer their boss alone.
After the run's last room there is nothing to offer.

## Parameters

### library

readonly [`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

The room library.

### route

[`RunRoute`](../interfaces/RunRoute.md)

The route so far.

## Returns

`number`[]

The next-room options, or an empty list after the last room.
