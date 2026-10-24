[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricReport

# Interface: MetricReport

A report's use of governed metrics, as checked by `checkReportMetrics`.

## Properties

### certified

> `readonly` **certified**: `boolean`

Whether the report is certified. A certified report may only use certified metrics.

***

### id

> `readonly` **id**: `string`

Report id.

***

### metricIds

> `readonly` **metricIds**: readonly `string`[]

Ids of the metrics the report shows.

***

### title

> `readonly` **title**: `string`

Report title.
