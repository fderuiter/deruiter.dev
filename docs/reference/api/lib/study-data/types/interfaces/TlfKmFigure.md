[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / TlfKmFigure

# Interface: TlfKmFigure

A Kaplan-Meier figure as a render model, which the SVG and HTML writers
read and a page can render directly.

## Properties

### atRisk

> `readonly` **atRisk**: readonly [`TlfAtRiskRow`](TlfAtRiskRow.md)[]

Rows of the number-at-risk table, one per curve.

***

### atRiskTimes

> `readonly` **atRiskTimes**: readonly [`TlfAtRiskTime`](TlfAtRiskTime.md)[]

Columns of the number-at-risk table, in time order.

***

### curves

> `readonly` **curves**: readonly [`TlfKmCurve`](TlfKmCurve.md)[]

One curve per treatment group, in protocol order.

***

### displayId

> `readonly` **displayId**: `string`

The ARS display.

***

### fileBase

> `readonly` **fileBase**: `string`

File name without extension, for example `f-14-2-2`.

***

### footnotes

> `readonly` **footnotes**: readonly `string`[]

Footnotes, in order.

***

### notice

> `readonly` **notice**: `string`

The synthetic-data notice.

***

### number

> `readonly` **number**: `string`

Figure number, for example `14.2.2`.

***

### outputId

> `readonly` **outputId**: `string`

The ARS output.

***

### population

> `readonly` **population**: `string`

Population line, for example `Safety Set`.

***

### summary

> `readonly` **summary**: `string`

Text alternative: what the figure shows, in words.

***

### test

> `readonly` **test**: [`TlfCell`](TlfCell.md)

The log-rank test line and the results it shows.

***

### title

> `readonly` **title**: `string`

Title.

***

### xLabel

> `readonly` **xLabel**: `string`

Horizontal axis title.

***

### yLabel

> `readonly` **yLabel**: `string`

Vertical axis title.
