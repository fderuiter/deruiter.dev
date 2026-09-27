[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useCanvasResolution](../README.md) / UseCanvasResolutionOptions

# Interface: UseCanvasResolutionOptions

## Properties

### active?

> `optional` **active?**: `boolean`

False while the canvas is not rendered yet, e.g. before hydration. Defaults to true.

***

### canvasRef

> **canvasRef**: `RefObject`\<`HTMLCanvasElement` \| `null`\>

Canvas whose backing store is sized.

***

### logicalHeight

> **logicalHeight**: `number`

Height of the coordinate space the game draws in.

***

### logicalWidth

> **logicalWidth**: `number`

Width of the coordinate space the game draws in.

***

### maxDpr?

> `optional` **maxDpr?**: `number`

Highest device pixel ratio honoured. Defaults to 2.

***

### onResize?

> `optional` **onResize?**: (`scale`) => `void`

Called after a resize, which clears the bitmap, so a paused game can redraw.

#### Parameters

##### scale

`number`

#### Returns

`void`
