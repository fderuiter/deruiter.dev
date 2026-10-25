[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/explore](../README.md) / Exploration

# Interface: Exploration

A self-service exploration (#2634): one governed metric, the dimensions it
is grouped by, the filters on it and how it is drawn. An exploration is
an exploratory report spec in the making; it is saved in the URL, never
on a server.

## Properties

### dimensions

> `readonly` **dimensions**: readonly [`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md)[]

Dimensions grouped by, in row order; at most two.

***

### filters

> `readonly` **filters**: readonly [`MetricFilter`](../../platform/interfaces/MetricFilter.md)[]

Filters, one per dimension, in dimension order. A filter replaces the
metric's default filter on the same dimension.

***

### metricId

> `readonly` **metricId**: `string`

Registry metric id.

***

### visual

> `readonly` **visual**: [`ReportVisual`](../../platform/type-aliases/ReportVisual.md) \| `null`

The visual chosen; `null` draws the one the explorer suggests.
