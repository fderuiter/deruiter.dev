[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/sql](../README.md) / toSql

# Function: toSql()

> **toSql**(`metric`, `dimensions`, `filters`, `dialect`, `options?`): `string`

Compiles a governed metric to one SQL SELECT statement over the gold
tables. The statement returns one column per grouped dimension, in query
order, then `value` as a double; with no dimensions it returns exactly one
row. Counts and sums are 0 over no rows, and a ratio with a zero
denominator is `NULL`, as in `evaluateMetric`.

## Parameters

### metric

[`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)

Metric definition.

### dimensions

readonly [`MetricDimensionId`](../../../../types/type-aliases/MetricDimensionId.md)[]

Dimensions to group by, in output order.

### filters

readonly [`MetricFilter`](../../../../types/interfaces/MetricFilter.md)[]

Filters; each replaces the metric's default filter on the same dimension.

### dialect

[`SqlDialect`](../../../../types/type-aliases/SqlDialect.md)

`duckdb`, `postgres` or `tsql`.

### options?

[`MetricCompileOptions`](../../../../types/interfaces/MetricCompileOptions.md) = `{}`

The data cut, for metrics that measure age at the cut.

## Returns

`string`

The statement, with a two-line comment header and a final semicolon.

## Throws

Error when the dimensions or filters are not allowed for the
metric, or the metric needs a data cut and none is given.
