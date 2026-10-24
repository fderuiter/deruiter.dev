[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricResultRow

# Interface: MetricResultRow

One row of a metric result.

## Properties

### dimensions

> `readonly` **dimensions**: `Readonly`\<`Partial`\<`Record`\<[`MetricDimensionId`](../type-aliases/MetricDimensionId.md), `string`\>\>\>

Value of each grouped dimension, keyed by dimension id.

***

### value

> `readonly` **value**: `number` \| `null`

Metric value, or `null` when it is undefined (for example a zero denominator).
