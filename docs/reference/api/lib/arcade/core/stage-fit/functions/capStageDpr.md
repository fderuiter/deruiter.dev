[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / capStageDpr

# Function: capStageDpr()

> **capStageDpr**(`devicePixelRatio`, `maxDpr?`): `number`

The device pixel ratio after the cap. A missing or invalid ratio is 1, and
an invalid cap is `MAX_CANVAS_DPR`. There is no 1x floor: a page zoomed out
below 1 keeps its real ratio, as Retro Labyrinth's fit always did.

## Parameters

### devicePixelRatio

`number`

The window's ratio.

### maxDpr?

`number` = `MAX_CANVAS_DPR`

The cap.

## Returns

`number`

The ratio the backing store is sized for.
