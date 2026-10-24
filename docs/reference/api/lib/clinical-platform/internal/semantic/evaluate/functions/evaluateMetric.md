[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/evaluate](../README.md) / evaluateMetric

# Function: evaluateMetric()

> **evaluateMetric**(`warehouse`, `metric`, `query?`): [`MetricResult`](../../../../types/interfaces/MetricResult.md)

Evaluates a governed metric over the gold tables of a warehouse. This is
the engine behind the platform's own dashboards; the SQL, MetricFlow and
TMDL compilers express the same definition for other consumers.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

A warehouse from `buildWarehouse`; its `asOf` is the data cut.

### metric

[`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)

Metric definition, usually from `METRIC_REGISTRY`.

### query?

[`MetricQuery`](../../../../types/interfaces/MetricQuery.md) = `{}`

Dimensions to group by and filters; defaults to one total.

## Returns

[`MetricResult`](../../../../types/interfaces/MetricResult.md)

One row per group, sorted by dimension values. Additive measures
(counts and sums) are 0 over no rows; means, medians, percentiles and
ratios with a zero denominator are `null`.

## Throws

Error when the query asks for a dimension or filter the metric
does not allow, or a `study` grain metric is not grouped by study.
