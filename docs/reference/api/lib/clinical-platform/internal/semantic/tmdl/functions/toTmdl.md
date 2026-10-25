[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/tmdl](../README.md) / toTmdl

# Function: toTmdl()

> **toTmdl**(`metrics`, `options?`): `string`

Compiles governed metrics to a Power BI TMDL table of DAX measures. Each
measure carries the metric's business definition, version, status, owner
and steward as its description, the metric's display folder and format
string, and annotations with the metric id, version and status. A `study`
grain metric is blank unless exactly one study is in context.

## Parameters

### metrics

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[]

Metrics to compile, usually `METRIC_REGISTRY`.

### options?

[`MetricCompileOptions`](../../../../types/semantic/interfaces/MetricCompileOptions.md) = `{}`

The data cut, for metrics that measure age at the cut.

## Returns

`string`

The TMDL text of one table, `Governed Metrics`, indented with tabs.

## Throws

Error when a metric needs a data cut and none is given.
