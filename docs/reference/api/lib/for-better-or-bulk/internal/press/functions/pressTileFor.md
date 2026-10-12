[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/press](../README.md) / pressTileFor

# Function: pressTileFor()

> **pressTileFor**(`state`, `person`): [`Tile`](../../../types/interfaces/Tile.md) \| `null`

The tile a press of the interact key acts on for a person standing as
`person` describes, or null when a press does nothing. Pure and
deterministic: the engine, the prompts, the canvas and the assist's route
all read this one rule.

With nothing in hand, the first faced tile (see `faceTiles`) that has stock,
an item on a station, or a loose item on the floor is used. With something
in hand, the first faced tile that takes the item is used. Failing that, a
station next to the person that takes the item is used, so standing beside
the arrange table puts roses on it and not on the floor. The floor is the
last choice, and only the tile in front of the nearest tile counts as the
floor.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### person

`Pick`\<[`Player`](../../../types/interfaces/Player.md), `"x"` \| `"y"` \| `"facingX"` \| `"facingY"` \| `"holding"`\>

## Returns

[`Tile`](../../../types/interfaces/Tile.md) \| `null`
