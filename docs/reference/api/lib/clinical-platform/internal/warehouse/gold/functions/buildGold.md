[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/gold](../README.md) / buildGold

# Function: buildGold()

> **buildGold**(`silver`, `asOf`): [`GoldTables`](../type-aliases/GoldTables.md)

Builds the gold layer from de-duplicated silver tables.

## Parameters

### silver

[`SilverTables`](../../silver/type-aliases/SilverTables.md)

Silver rows per table.

### asOf

`string`

ISO 8601 data cut, the last month-end KRI snapshot.

## Returns

[`GoldTables`](../type-aliases/GoldTables.md)

Gold rows per table.
