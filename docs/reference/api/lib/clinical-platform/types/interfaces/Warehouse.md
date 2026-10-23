[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / Warehouse

# Interface: Warehouse

The silver and gold layers built from one portfolio.

## Properties

### asOf

> `readonly` **asOf**: `string`

ISO 8601 data cut.

***

### portfolioId

> `readonly` **portfolioId**: `string`

Id of the portfolio the warehouse was built from.

***

### seed

> `readonly` **seed**: `number`

Seed of that portfolio.

***

### tables

> `readonly` **tables**: `Readonly`\<`Record`\<`string`, readonly [`WarehouseRow`](../type-aliases/WarehouseRow.md)[]\>\>

Rows per qualified table name (`silver.edc_subject`), in schema order.
