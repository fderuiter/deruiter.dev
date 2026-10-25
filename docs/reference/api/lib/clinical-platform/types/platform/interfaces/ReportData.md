[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / ReportData

# Interface: ReportData

A report evaluated over one warehouse, ready to render.

## Properties

### calculations

> `readonly` **calculations**: readonly [`ReportCalculation`](ReportCalculation.md)[]

How each metric is calculated, in column order.

***

### columns

> `readonly` **columns**: readonly [`ReportColumn`](ReportColumn.md)[]

One column per metric, in order.

***

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut of the warehouse.

***

### dimensionLabels

> `readonly` **dimensionLabels**: readonly `string`[]

Label of each grouped dimension, in order.

***

### rows

> `readonly` **rows**: readonly [`ReportRow`](ReportRow.md)[]

One row per group, sorted by dimension values.

***

### scale

> `readonly` **scale**: [`ReportScale`](ReportScale.md) \| `null`

Value axis of a bar or line report; `null` for a stat or table report.

***

### spec

> `readonly` **spec**: [`ReportSpec`](ReportSpec.md)

The spec.
