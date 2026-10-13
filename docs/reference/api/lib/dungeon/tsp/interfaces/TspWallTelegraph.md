[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/tsp](../README.md) / TspWallTelegraph

# Interface: TspWallTelegraph

What the walls do next, so the player can plan a route around them.

## Properties

### appearing

> **appearing**: `string`[]

Cells that become walls on that shift ("x,y").

***

### stepsUntilAppear

> **stepsUntilAppear**: `number` \| `null`

Moves until the next shift that adds a wall cell (1 to 4, since the walls
repeat every four moves), or null when no shift adds one.

***

### vanishing

> **vanishing**: `string`[]

Walls standing now that the very next move takes away ("x,y").
