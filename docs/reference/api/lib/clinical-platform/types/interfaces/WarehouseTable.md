[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WarehouseTable

# Interface: WarehouseTable

One warehouse table: silver conformed data, or a gold dimension or fact.

## Properties

### columns

> `readonly` **columns**: readonly [`WarehouseColumn`](WarehouseColumn.md)[]

Columns, in table order.

***

### description

> `readonly` **description**: `string`

One sentence on what the table holds.

***

### grain

> `readonly` **grain**: `string`

What one row stands for.

***

### kind

> `readonly` **kind**: [`WarehouseTableKind`](../type-aliases/WarehouseTableKind.md)

Role of the table.

***

### layer

> `readonly` **layer**: [`WarehouseLayer`](../type-aliases/WarehouseLayer.md)

Layer, which is also the SQL schema name.

***

### name

> `readonly` **name**: `string`

Table name, unique across the warehouse.

***

### primaryKey

> `readonly` **primaryKey**: readonly `string`[]

Primary key columns, which enforce the grain.

***

### scd2

> `readonly` **scd2**: [`Scd2Definition`](Scd2Definition.md) \| `null`

SCD type 2 settings, or `null` for a table that keeps no history.

***

### uniqueKeys

> `readonly` **uniqueKeys**: readonly (readonly `string`[])[]

Further unique column sets, such as a dimension's natural key.
