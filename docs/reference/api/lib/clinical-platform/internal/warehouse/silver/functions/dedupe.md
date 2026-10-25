[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/silver](../README.md) / dedupe

# Function: dedupe()

> **dedupe**(`rows`, `keyColumns`): `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]

Keeps one row per key. A later record for a key replaces the earlier one,
as a resent record supersedes the first delivery; the row keeps the
position of the key's first appearance.

## Parameters

### rows

readonly `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]

### keyColumns

readonly `string`[]

## Returns

`Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]
