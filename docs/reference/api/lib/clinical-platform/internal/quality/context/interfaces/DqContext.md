[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/quality/context](../README.md) / DqContext

# Interface: DqContext

A warehouse as rules read it.

## Properties

### asOf

> `readonly` **asOf**: `string`

## Methods

### groups()

> **groups**(`table`, `column`): `ReadonlyMap`\<[`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md), readonly `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]\>

Rows of a table grouped by the value of one column.

#### Parameters

##### table

`string`

##### column

`string`

#### Returns

`ReadonlyMap`\<[`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md), readonly `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]\>

***

### index()

> **index**(`table`, `column`): `ReadonlyMap`\<[`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md), `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>\>

Rows of a table by the value of one column; the last row wins on a tie.

#### Parameters

##### table

`string`

##### column

`string`

#### Returns

`ReadonlyMap`\<[`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md), `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>\>

***

### rows()

> **rows**(`table`): readonly `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]

#### Parameters

##### table

`string`

#### Returns

readonly `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../../../types/platform/type-aliases/WarehouseValue.md)\>\>[]
