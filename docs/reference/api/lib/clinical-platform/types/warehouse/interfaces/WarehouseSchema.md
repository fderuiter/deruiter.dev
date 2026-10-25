[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/warehouse](../README.md) / WarehouseSchema

# Interface: WarehouseSchema

The typed description of the silver and gold layers.

## Properties

### tables

> `readonly` **tables**: readonly [`WarehouseTable`](../../platform/interfaces/WarehouseTable.md)[]

Tables in creation order: silver, then gold dimensions, then gold facts.

***

### version

> `readonly` **version**: `string`

Semantic version of the schema.
