[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/viewport](../README.md) / computeCanvasResolution

# Function: computeCanvasResolution()

> **computeCanvasResolution**(`logicalWidth`, `logicalHeight`, `cssWidth`, `devicePixelRatio`, `maxDpr?`): [`CanvasResolution`](../interfaces/CanvasResolution.md)

Sizes a canvas backing store to the device pixels it is displayed at, so
text and vector art stay sharp on HiDPI screens while game logic keeps
working in logical units. The scale never drops below 1, so a canvas
shown smaller than its logical size keeps its full detail, and the device
pixel ratio is capped at `maxDpr`. Degenerate inputs fall back to the
logical size.

## Parameters

### logicalWidth

`number`

### logicalHeight

`number`

### cssWidth

`number`

### devicePixelRatio

`number`

### maxDpr?

`number` = `MAX_CANVAS_DPR`

## Returns

[`CanvasResolution`](../interfaces/CanvasResolution.md)
