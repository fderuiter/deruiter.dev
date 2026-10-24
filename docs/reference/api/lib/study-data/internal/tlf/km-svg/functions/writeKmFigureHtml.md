[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/km-svg](../README.md) / writeKmFigureHtml

# Function: writeKmFigureHtml()

> **writeKmFigureHtml**(`figure`): `string`

Writes the figure as a standalone, accessible HTML document: the SVG
inside a captioned `<figure>`, then the data-table fallback (every
plotted value by treatment group, and the number at risk), the log-rank
test, the footnotes and the synthetic-data notice.

The output depends only on the figure, so the same run always gives the
same bytes. Lines end with LF.

## Parameters

### figure

[`TlfKmFigure`](../../../../types/interfaces/TlfKmFigure.md)

## Returns

`string`

## Throws

RangeError when the figure has more groups than line colours.
