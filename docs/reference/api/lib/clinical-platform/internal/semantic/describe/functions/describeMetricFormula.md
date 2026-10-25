[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/describe](../README.md) / describeMetricFormula

# Function: describeMetricFormula()

> **describeMetricFormula**(`metric`): `string`

Describes how a metric is computed from the gold tables, in one line, for
example `(count of gold.fct_query rows) / (count of gold.fct_visit rows
where visit_date_key is not null), times 100`.

## Parameters

### metric

[`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)

Metric definition.

## Returns

`string`

The formula in words.
