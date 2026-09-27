[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useCanvasResolution](../README.md) / useCanvasResolution

# Function: useCanvasResolution()

> **useCanvasResolution**(`__namedParameters`): `RefObject`\<`number`\>

Keeps a game canvas's backing store matched to its displayed size times the
device pixel ratio, observing width changes only. Returns a ref holding the
current scale; render loops call `ctx.setTransform(scale, 0, 0, scale, 0, 0)`
before each frame so drawing and hit-testing stay in logical units.

## Parameters

### \_\_namedParameters

[`UseCanvasResolutionOptions`](../interfaces/UseCanvasResolutionOptions.md)

## Returns

`RefObject`\<`number`\>
