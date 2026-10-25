[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / ContractObjectRows

# Interface: ContractObjectRows

The rows of one contract object, as a contract check reads them.

## Properties

### columns

> `readonly` **columns**: readonly `string`[]

Column names present in the data, in order.

***

### rows

> `readonly` **rows**: readonly `Readonly`\<`Record`\<`string`, [`WarehouseValue`](../../platform/type-aliases/WarehouseValue.md)\>\>[]

Rows, keyed by column name.
