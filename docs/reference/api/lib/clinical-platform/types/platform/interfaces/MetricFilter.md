[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / MetricFilter

# Interface: MetricFilter

A dimension filter: keep rows whose dimension value is, or is not, listed.

## Properties

### dimension

> `readonly` **dimension**: [`MetricDimensionId`](../type-aliases/MetricDimensionId.md)

Dimension filtered on.

***

### operator

> `readonly` **operator**: `"in"` \| `"not-in"`

`in` keeps listed values, `not-in` drops them.

***

### values

> `readonly` **values**: readonly `string`[]

Values; never empty.
