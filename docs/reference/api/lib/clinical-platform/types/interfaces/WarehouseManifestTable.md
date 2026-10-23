[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WarehouseManifestTable

# Interface: WarehouseManifestTable

One table in an export manifest.

## Properties

### columns

> `readonly` **columns**: readonly [`WarehouseManifestColumn`](WarehouseManifestColumn.md)[]

Columns, in file order.

***

### path

> `readonly` **path**: `string`

CSV path.

***

### primaryKey

> `readonly` **primaryKey**: readonly `string`[]

Primary key columns.

***

### rowCount

> `readonly` **rowCount**: `number`

Number of data rows.

***

### table

> `readonly` **table**: `string`

Qualified table name.
