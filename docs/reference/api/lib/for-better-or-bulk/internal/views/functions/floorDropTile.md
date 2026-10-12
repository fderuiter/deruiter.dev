[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / floorDropTile

# Function: floorDropTile()

> **floorDropTile**(`state`, `id`): [`Tile`](../../../types/interfaces/Tile.md) \| `null`

The tile a press would drop the carried item on, when that tile is plain
floor: nothing carried, a busy or away person, or a press that lands on a
station, crate or target gives null. The canvas draws a floor drop in its
own warning style, so the drop is clear before the press.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

## Returns

[`Tile`](../../../types/interfaces/Tile.md) \| `null`
