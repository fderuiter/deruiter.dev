[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/define](../README.md) / TableDraft

# Interface: TableDraft

One table as written in the schema.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../../../../types/platform/type-aliases/DataClassification.md)

Default classification of the table's columns.

***

### columns

> `readonly` **columns**: readonly [`ColumnDraft`](../type-aliases/ColumnDraft.md)[]

***

### description

> `readonly` **description**: `string`

***

### grain

> `readonly` **grain**: `string`

***

### kind

> `readonly` **kind**: [`WarehouseTableKind`](../../../../types/platform/type-aliases/WarehouseTableKind.md)

***

### layer

> `readonly` **layer**: [`WarehouseLayer`](../../../../types/platform/type-aliases/WarehouseLayer.md)

***

### name

> `readonly` **name**: `string`

***

### primaryKey

> `readonly` **primaryKey**: readonly `string`[]

***

### scd2?

> `readonly` `optional` **scd2?**: [`Scd2Definition`](../../../../types/platform/interfaces/Scd2Definition.md)

***

### sequences?

> `readonly` `optional` **sequences?**: readonly (readonly `string`[])[]

Date columns reached in order. Default none.

***

### source

> `readonly` **source**: `string` \| `null`

Default lineage source, as `layer.product`, or `null` for generated tables.

***

### synthetic

> `readonly` **synthetic**: `boolean`

Whether rows describe synthetic records and carry `is_synthetic`.

***

### uniqueKeys?

> `readonly` `optional` **uniqueKeys?**: readonly (readonly `string`[])[]
