[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / DsqlInsertBatch

# Interface: DsqlInsertBatch

One parameterised `INSERT` of a DSQL load: up to the batch limit of one table's rows.

## Properties

### rowCount

> `readonly` **rowCount**: `number`

Rows the statement inserts.

***

### table

> `readonly` **table**: `string`

Qualified table name, for example `gold.dim_site`.

***

### text

> `readonly` **text**: `string`

Statement text with `$1`, `$2`, ... placeholders, row by row.

***

### values

> `readonly` **values**: readonly [`WarehouseValue`](../type-aliases/WarehouseValue.md)[]

Parameter values in placeholder order; decimals as text at their declared scale.
