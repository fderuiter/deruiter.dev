[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/semantic](../README.md) / MetricResult

# Interface: MetricResult

A metric evaluated over one warehouse.

## Properties

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut of the warehouse.

***

### dimensions

> `readonly` **dimensions**: readonly [`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md)[]

Grouped dimensions, in output order.

***

### filters

> `readonly` **filters**: readonly [`MetricFilter`](../../platform/interfaces/MetricFilter.md)[]

Filters in force: the query's, then the defaults it did not replace.

***

### metricId

> `readonly` **metricId**: `string`

Metric id.

***

### rows

> `readonly` **rows**: readonly [`MetricResultRow`](MetricResultRow.md)[]

One row per group, sorted by dimension values.

***

### version

> `readonly` **version**: `string`

Metric version.
