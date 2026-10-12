[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / nextSpotTile

# Function: nextSpotTile()

> **nextSpotTile**(`state`, `id`): [`Tile`](../../../types/interfaces/Tile.md) \| `null`

The open spot a carried item goes on, nearest to the person: an open chair
spot for chairs and an open lantern hook for a lantern. Distance is measured
in tiles from the tile the person stands on, and a tie goes to the spot
listed first in the venue. Null when the person carries neither, or no such
spot is open. Pure; the canvas highlights the tile it returns.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

## Returns

[`Tile`](../../../types/interfaces/Tile.md) \| `null`
