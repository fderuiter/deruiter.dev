[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / TlfKmCurve

# Interface: TlfKmCurve

One treatment group's Kaplan-Meier curve.

## Properties

### bigN

> `readonly` **bigN**: `number`

Subjects in the analysis set and group (N).

***

### bigNResultId

> `readonly` **bigNResultId**: `string`

The result that N comes from.

***

### groupId

> `readonly` **groupId**: `string`

The group of the curve.

***

### groupingId

> `readonly` **groupingId**: `string`

The grouping factor of the curve.

***

### id

> `readonly` **id**: `string`

Stable id, for example `curve1`.

***

### label

> `readonly` **label**: `string`

The treatment, for example `Placebo`.

***

### points

> `readonly` **points**: readonly [`TlfKmPoint`](TlfKmPoint.md)[]

Plotted times in ascending order, starting at 0; empty for a group with no records.
