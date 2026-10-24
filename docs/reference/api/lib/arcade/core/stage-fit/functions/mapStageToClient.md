[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / mapStageToClient

# Function: mapStageToClient()

> **mapStageToClient**(`gameX`, `gameY`, `rect`, `aspect`): \{ `x`: `number`; `y`: `number`; \} \| `null`

Maps a game point to client pixels on a canvas shown at `rect`, to place
DOM overlays over the game.

## Parameters

### gameX

`number`

X, in game units.

### gameY

`number`

Y, in game units.

### rect

[`StageRect`](../interfaces/StageRect.md)

Where the canvas is shown.

### aspect

[`StageAspect`](../interfaces/StageAspect.md)

The game's logical size.

## Returns

\{ `x`: `number`; `y`: `number`; \} \| `null`

The client position, or null when the rect is empty.
