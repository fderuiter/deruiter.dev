[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / TlfSection

# Interface: TlfSection

A block of rows under one heading. When the heading itself carries
results, as a system organ class does, `cells` holds them.

## Properties

### cells?

> `readonly` `optional` **cells?**: readonly [`TlfCell`](TlfCell.md)[]

One cell per column when the heading has results, otherwise absent.

***

### id

> `readonly` **id**: `string`

Stable id within the table.

***

### label

> `readonly` **label**: `string`

The heading, for example `Age (years)`.

***

### rows

> `readonly` **rows**: readonly [`TlfRow`](TlfRow.md)[]

The rows under the heading.
