[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/lineage](../README.md) / parseColumnRef

# Function: parseColumnRef()

> **parseColumnRef**(`ref`): [`ColumnRef`](../../../../types/platform/interfaces/ColumnRef.md)

Parses a lineage reference such as `bronze.edc.subjects.subjectId` or
`silver.edc_visit.visit_date` into a column reference. The product is
everything between the layer and the column, prefixed with the layer.

## Parameters

### ref

`string`

## Returns

[`ColumnRef`](../../../../types/platform/interfaces/ColumnRef.md)

## Throws

RangeError when the reference has no known layer, product or column.
