[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / WarehouseManifestColumn

# Interface: WarehouseManifestColumn

One column in an export manifest.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../type-aliases/DataClassification.md)

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

> `readonly` **type**: [`WarehouseColumnType`](../type-aliases/WarehouseColumnType.md)

Logical type.
