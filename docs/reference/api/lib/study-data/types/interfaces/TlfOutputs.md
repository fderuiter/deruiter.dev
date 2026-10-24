[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / TlfOutputs

# Interface: TlfOutputs

The analysis results of a run: the reporting event, its tables and its figures.

## Properties

### figures

> `readonly` **figures**: readonly [`TlfKmFigure`](TlfKmFigure.md)[]

The figures, in output order.

***

### reportingEvent

> `readonly` **reportingEvent**: [`ArsReportingEvent`](ArsReportingEvent.md)

The ARS reporting event, with results and row sets.

***

### tables

> `readonly` **tables**: readonly [`TlfTable`](TlfTable.md)[]

The tables, in output order.
