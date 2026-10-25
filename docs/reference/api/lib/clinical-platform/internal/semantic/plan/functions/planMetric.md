[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/plan](../README.md) / planMetric

# Function: planMetric()

> **planMetric**(`metric`, `query`, `dataCut`): [`MetricPlan`](../interfaces/MetricPlan.md)

Checks a query against a metric and locates every grouped and filtered
dimension on every table the formula reads.

## Parameters

### metric

[`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)

Metric definition.

### query

[`MetricQuery`](../../../../types/semantic/interfaces/MetricQuery.md)

Dimensions and filters requested.

### dataCut

`string` \| `null`

ISO 8601 data cut, needed when the metric uses it.

## Returns

[`MetricPlan`](../interfaces/MetricPlan.md)

The plan.

## Throws

Error when a dimension or filter is not allowed for the metric, a
`study` grain metric is not grouped by study, a filter lists no values, or
the data cut is missing or not a date.
