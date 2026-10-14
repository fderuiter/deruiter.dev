[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / describeRouteMap

# Function: describeRouteMap()

> **describeRouteMap**(`library`, `route`): [`RouteMapStep`](../interfaces/RouteMapStep.md)[]

The whole run as a map: the rooms played, the next choice, and the steps
ahead with their bosses named.

## Parameters

### library

readonly [`DungeonRoom`](../../types/interfaces/DungeonRoom.md)[]

The room library.

### route

[`RunRoute`](../interfaces/RunRoute.md)

The route so far.

## Returns

[`RouteMapStep`](../interfaces/RouteMapStep.md)[]

One entry per step of the run.
