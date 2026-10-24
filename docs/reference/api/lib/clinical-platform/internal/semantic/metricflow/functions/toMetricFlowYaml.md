[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/metricflow](../README.md) / toMetricFlowYaml

# Function: toMetricFlowYaml()

> **toMetricFlowYaml**(`metrics`, `options?`): `string`

Compiles governed metrics to one dbt MetricFlow YAML file: a semantic model
per gold table they read or group by, and a MetricFlow metric per governed
metric. Ratio numerators and denominators, and the two dates of a milestone
span, become helper metrics named after the metric. A metric's version,
status, owner, steward, unit and allowed dimensions go in its `meta`.

## Parameters

### metrics

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[]

Metrics to compile, usually `METRIC_REGISTRY`.

### options?

[`MetricCompileOptions`](../../../../types/interfaces/MetricCompileOptions.md) = `{}`

The data cut, for metrics that measure age at the cut.

## Returns

`string`

The YAML text, with a comment header.

## Throws

Error when a metric needs a data cut and none is given.
