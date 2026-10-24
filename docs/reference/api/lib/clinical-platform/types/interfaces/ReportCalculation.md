[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ReportCalculation

# Interface: ReportCalculation

How one metric in a report is calculated, for the "how this number is calculated" panel.

## Properties

### description

> `readonly` **description**: `string`

Business definition.

***

### formula

> `readonly` **formula**: `string`

The formula in words.

***

### metricId

> `readonly` **metricId**: `string`

Metric id.

***

### name

> `readonly` **name**: `string`

Metric name.

***

### sql

> `readonly` **sql**: `string`

DuckDB SQL that computes the metric with the report's grouping and filters.

***

### status

> `readonly` **status**: [`MetricStatus`](../type-aliases/MetricStatus.md)

Metric status.

***

### version

> `readonly` **version**: `string`

Metric version.
