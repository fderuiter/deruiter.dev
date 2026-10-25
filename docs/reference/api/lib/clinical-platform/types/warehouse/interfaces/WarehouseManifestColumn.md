[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/warehouse](../README.md) / WarehouseManifestColumn

# Interface: WarehouseManifestColumn

One column in an export manifest.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../../platform/type-aliases/DataClassification.md)

Data classification.

***

### name

> `readonly` **name**: `string`

Column name.

***

### nullable

> `readonly` **nullable**: `boolean`

Whether the column may hold `null`.

***

### parquet

> `readonly` **parquet**: [`ParquetColumnType`](ParquetColumnType.md)

Parquet type a writer should use.

***

### type

> `readonly` **type**: [`WarehouseColumnType`](../../platform/type-aliases/WarehouseColumnType.md)

Logical type.
