[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ReportScale

# Interface: ReportScale

The value axis of a bar or line report. Its metrics share one unit and
format, so one set of labels serves every series.

## Properties

### max

> `readonly` **max**: `number`

Top of the axis: the highest tick.

***

### min

> `readonly` **min**: `number`

Bottom of the axis: 0, or the lowest tick below a negative value.

***

### ticks

> `readonly` **ticks**: readonly [`ReportTick`](ReportTick.md)[]

Gridlines from `min` to `max`, evenly spaced, with their labels.
