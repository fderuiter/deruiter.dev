[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/warehouse](../README.md) / ParquetColumnType

# Interface: ParquetColumnType

Parquet type a manifest column maps to.

## Properties

### logicalType

> `readonly` **logicalType**: `string` \| `null`

Parquet logical type annotation, or `null` when there is none.

***

### physicalType

> `readonly` **physicalType**: `"BYTE_ARRAY"` \| `"INT32"` \| `"INT64"` \| `"BOOLEAN"`

Parquet physical type.

***

### repetition

> `readonly` **repetition**: `"REQUIRED"` \| `"OPTIONAL"`

`REQUIRED` for a non-nullable column, otherwise `OPTIONAL`.
