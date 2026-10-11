[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/press](../README.md) / workTileFor

# Function: workTileFor()

> **workTileFor**(`state`, `person`): [`Tile`](../../../types/interfaces/Tile.md)

The tile that work (holding the arrange, petals or bin work key) acts on: the
first faced tile that has a station or target, else the tile in front of the
nearest tile. Shares `faceTiles` with `pressTileFor`, so work and presses
agree when a body straddles two tiles.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### person

`Pick`\<[`Player`](../../../types/interfaces/Player.md), `"x"` \| `"y"` \| `"facingX"` \| `"facingY"`\>

## Returns

[`Tile`](../../../types/interfaces/Tile.md)
