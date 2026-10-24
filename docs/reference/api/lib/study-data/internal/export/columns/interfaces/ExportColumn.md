[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/columns](../README.md) / ExportColumn

# Interface: ExportColumn

One checked column of a dataset.

## Properties

### storage

> `readonly` **storage**: [`StorageKind`](../type-aliases/StorageKind.md)

***

### textLength?

> `readonly` `optional` **textLength?**: `number`

Longest UTF-8 byte length of the values, at least 1. Text storage only.

***

### values

> `readonly` **values**: readonly [`CellValue`](../../../../types/type-aliases/CellValue.md)[]

***

### variable

> `readonly` **variable**: [`VariableMeta`](../../../../types/interfaces/VariableMeta.md)
