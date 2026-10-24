[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/format](../README.md) / formatMetricValue

# Function: formatMetricValue()

> **formatMetricValue**(`metric`, `value`): `string`

A metric value as displayed: a `percent` fraction times 100 with a
percent sign, a `currency` value in US dollars, a `number` as it is, each
to the definition's decimal places with US digit grouping.

## Parameters

### metric

`Pick`\<[`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md), `"format"`\>

The metric the value belongs to.

### value

`number` \| `null`

The value, or `null` when the metric has none.

## Returns

`string`

The display text; [NO\_METRIC\_VALUE](../variables/NO_METRIC_VALUE.md) for `null` or a value
  that is not finite.
