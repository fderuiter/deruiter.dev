[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/sim](../README.md) / interactTile

# Function: interactTile()

> **interactTile**(`state`, `id`): [`Tile`](../../../types/interfaces/Tile.md) \| `null`

The tile a press of the interact key acts on for one person right now, or
null when a press does nothing. Pure and deterministic: the engine, the
prompts and the canvas all read this one rule.

With nothing in hand, the faced tile is used when it has stock, an item on a
station, or a loose item on the floor. With something in hand, the faced
tile is used when it takes the item. Failing that, a station next to the
person that takes the item is used, so standing beside the arrange table
puts roses on it and not on the floor. The floor is the last choice, and
only the faced tile counts as the floor.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

## Returns

[`Tile`](../../../types/interfaces/Tile.md) \| `null`
