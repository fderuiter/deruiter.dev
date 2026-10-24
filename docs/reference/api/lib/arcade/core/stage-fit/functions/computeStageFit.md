[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / computeStageFit

# Function: computeStageFit()

> **computeStageFit**(`slot`, `devicePixelRatio`, `options`): [`StageFit`](../interfaces/StageFit.md)

Fits a game of the given aspect into a stage slot: the largest CSS box at
that aspect that fits, snapped by the scale mode, and the backing-store size
at the capped device pixel ratio.

## Parameters

### slot

[`StageSlot`](../interfaces/StageSlot.md)

The measured slot, in CSS pixels.

### devicePixelRatio

`number`

The window's device pixel ratio.

### options

[`StageFitOptions`](../interfaces/StageFitOptions.md)

Aspect, scale mode, DPR cap and scale floor.

## Returns

[`StageFit`](../interfaces/StageFit.md)

The box and backing store. The box never exceeds the slot.
