[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricDimension

# Interface: MetricDimension

One dimension of the semantic layer: an attribute of a gold dimension table.

## Properties

### column

> `readonly` **column**: `string`

Attribute column in that table.

***

### description

> `readonly` **description**: `string`

What the dimension's values are, in one sentence.

***

### id

> `readonly` **id**: [`MetricDimensionId`](../type-aliases/MetricDimensionId.md)

Stable dimension id.

***

### label

> `readonly` **label**: `string`

Display label.

***

### table

> `readonly` **table**: `string`

Qualified gold table that holds the attribute, for example `gold.dim_study`.
