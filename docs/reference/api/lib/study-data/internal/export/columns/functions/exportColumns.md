[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/columns](../README.md) / exportColumns

# Function: exportColumns()

> **exportColumns**(`dataset`): readonly [`ExportColumn`](../interfaces/ExportColumn.md)[]

Reads a dataset's columns in variable order, checking every value against
the variable's type.

## Parameters

### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

## Returns

readonly [`ExportColumn`](../interfaces/ExportColumn.md)[]

## Throws

TypeError when a value does not match its column's type, or a
  column is missing or the wrong length.

## Throws

RangeError when an ADaM timing value is not a complete ISO 8601
  value.
