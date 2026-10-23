[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / stageViewportMetrics

# Function: stageViewportMetrics()

> **stageViewportMetrics**(`rect`, `aspect`, `dpr?`): [`ViewportMetrics`](../../viewport/interfaces/ViewportMetrics.md)

The viewport metrics `screenToGameCoords` reads for a canvas shown at
`rect`: one scale for both axes, since the box keeps the aspect.

## Parameters

### rect

[`StageRect`](../interfaces/StageRect.md)

Where the canvas is shown, in client pixels.

### aspect

[`StageAspect`](../interfaces/StageAspect.md)

The game's logical size.

### dpr?

`number` = `1`

The device pixel ratio (only carried along).

## Returns

[`ViewportMetrics`](../../viewport/interfaces/ViewportMetrics.md)

Metrics with no offset; the rect already starts at the game.
