[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / mapClientToStage

# Function: mapClientToStage()

> **mapClientToStage**(`clientX`, `clientY`, `rect`, `aspect`): [`StagePoint`](../interfaces/StagePoint.md) \| `null`

Maps a pointer's client position to game units on a canvas shown at
`rect` (its `getBoundingClientRect()`).

## Parameters

### clientX

`number`

Pointer x, in client pixels.

### clientY

`number`

Pointer y, in client pixels.

### rect

[`StageRect`](../interfaces/StageRect.md)

Where the canvas is shown.

### aspect

[`StageAspect`](../interfaces/StageAspect.md)

The game's logical size.

## Returns

[`StagePoint`](../interfaces/StagePoint.md) \| `null`

The game point, or null when the rect is empty.
