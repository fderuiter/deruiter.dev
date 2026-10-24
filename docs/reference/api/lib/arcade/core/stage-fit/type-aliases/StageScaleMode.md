[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/core/stage-fit](../README.md) / StageScaleMode

# Type Alias: StageScaleMode

> **StageScaleMode** = `"integer"` \| `"fractional"`

How the box is snapped.

- `integer`: each game unit is a whole number of device pixels, the largest
  that fits. Pixel art stays free of uneven pixels and blur.
- `fractional`: the largest box that fits, its CSS width snapped to the
  smallest step that keeps the height a whole number of pixels too.
