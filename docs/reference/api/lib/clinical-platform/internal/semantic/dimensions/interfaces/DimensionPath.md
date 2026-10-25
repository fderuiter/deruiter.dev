[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/dimensions](../README.md) / DimensionPath

# Interface: DimensionPath

How a measure's row reaches a dimension attribute: a column of the row
itself, or a column of a dimension table joined on `join.from = join.to`.

## Properties

### column

> `readonly` **column**: `string`

Attribute column.

***

### id

> `readonly` **id**: [`MetricDimensionId`](../../../../types/platform/type-aliases/MetricDimensionId.md)

Dimension id.

***

### join

> `readonly` **join**: \{ `from`: `string`; `to`: `string`; \} \| `null`

Join from the measure's table, or `null` when the attribute is on it.

***

### table

> `readonly` **table**: `string`

Qualified table holding the attribute.
