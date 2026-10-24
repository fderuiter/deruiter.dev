[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricMeasure

# Interface: MetricMeasure

One aggregation over the rows of one gold table.

## Properties

### aggregation

> `readonly` **aggregation**: [`MetricAggregation`](../type-aliases/MetricAggregation.md)

Aggregation.

***

### expression

> `readonly` **expression**: [`MetricExpression`](../type-aliases/MetricExpression.md) \| `null`

Value aggregated per row; `null` for `count`, a column for
`count-distinct`, a number for the other aggregations.

***

### table

> `readonly` **table**: `string`

Qualified gold table the rows come from, for example `gold.fct_query`.

***

### timeKey

> `readonly` **timeKey**: `string` \| `null`

Date key column that places a row in a calendar month for the `month`
dimension, or `null` when the measure has no meaningful month.

***

### where

> `readonly` **where**: readonly [`MetricPredicate`](../type-aliases/MetricPredicate.md)[]

Conditions every counted row meets, all of them (a logical AND).
