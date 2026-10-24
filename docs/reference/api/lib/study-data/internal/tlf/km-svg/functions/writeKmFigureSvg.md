[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/km-svg](../README.md) / writeKmFigureSvg

# Function: writeKmFigureSvg()

> **writeKmFigureSvg**(`figure`): `string`

Writes the figure as a standalone SVG image with its text alternative.
The output depends only on the figure, so the same run always gives the
same bytes. Lines end with LF.

## Parameters

### figure

[`TlfKmFigure`](../../../../types/interfaces/TlfKmFigure.md)

## Returns

`string`

## Throws

RangeError when the figure has more groups than line colours.
