[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/viewport](../README.md) / applyCanvasScale

# Function: applyCanvasScale()

> **applyCanvasScale**(`ctx`, `scale`): `void`

Scales a 2D context so drawing in logical units fills a backing store sized
by `computeCanvasResolution`. Replaces any earlier transform; a context
without `setTransform` (a minimal test double) is left untouched.

## Parameters

### ctx

`CanvasRenderingContext2D`

### scale

`number`

## Returns

`void`
