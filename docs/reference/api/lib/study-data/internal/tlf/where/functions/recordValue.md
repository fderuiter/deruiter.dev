[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/where](../README.md) / recordValue

# Function: recordValue()

> **recordValue**(`context`, `dataset`, `variable`): [`CellValue`](../../../../types/type-aliases/CellValue.md)

The value of `dataset.variable` for a record: read from the record itself,
or from the subject's ADSL row when `dataset` is ADSL.

## Parameters

### context

[`RecordContext`](../interfaces/RecordContext.md)

### dataset

`string`

### variable

`string`

## Returns

[`CellValue`](../../../../types/type-aliases/CellValue.md)

## Throws

RangeError when `dataset` is neither the record's dataset nor ADSL.
