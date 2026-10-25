[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/context](../README.md) / addRow

# Function: addRow()

> **addRow**(`warehouse`, `table`, `match`, `change`): [`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

A copy of the warehouse with a copy of the first matching row added,
changed, at the end of its table.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

### table

`string`

### match

(`row`) => `boolean`

### change

(`row`) => `Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>

## Returns

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)
