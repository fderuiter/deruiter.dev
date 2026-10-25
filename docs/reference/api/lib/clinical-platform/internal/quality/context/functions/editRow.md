[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/context](../README.md) / editRow

# Function: editRow()

> **editRow**(`warehouse`, `table`, `match`, `change`): [`Warehouse`](../../../../types/interfaces/Warehouse.md)

A copy of the warehouse with the first row of a table that matches
changed.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

### table

`string`

### match

(`row`) => `boolean`

### change

(`row`) => `Record`\<`string`, [`WarehouseValue`](../../../../types/type-aliases/WarehouseValue.md)\>

## Returns

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

## Throws

Error when no row matches, so a fault never silently does nothing.
