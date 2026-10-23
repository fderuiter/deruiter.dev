[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / StageFitOptions

# Interface: StageFitOptions

Options for [computeStageFit](../functions/computeStageFit.md).

## Properties

### aspect

> **aspect**: [`StageAspect`](StageAspect.md)

The game's logical size.

***

### maxDpr?

> `optional` **maxDpr?**: `number`

Highest device pixel ratio the backing store is sized for. Defaults to
`MAX_CANVAS_DPR` (2). `Infinity` follows the device.

***

### minScale?

> `optional` **minScale?**: `number`

Fewest backing-store pixels per game unit. A slot too small for it shows
the canvas shrunk rather than with less detail. In `integer` mode it is
rounded up and never below 1; in `fractional` mode it defaults to 0, so
the backing store follows the box.

***

### scale

> **scale**: [`StageScaleMode`](../type-aliases/StageScaleMode.md)

How the box is snapped.
