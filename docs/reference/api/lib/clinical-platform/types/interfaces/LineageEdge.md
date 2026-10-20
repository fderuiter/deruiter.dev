[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / LineageEdge

# Interface: LineageEdge

One column-level lineage edge, exportable as an OpenLineage column facet.

## Properties

### from

> `readonly` **from**: [`ColumnRef`](ColumnRef.md)

Source column.

***

### to

> `readonly` **to**: [`ColumnRef`](ColumnRef.md)

Target column.

***

### transformation

> `readonly` **transformation**: `string`

Transformation applied, for example `identity`, `cast` or `aggregate`.
