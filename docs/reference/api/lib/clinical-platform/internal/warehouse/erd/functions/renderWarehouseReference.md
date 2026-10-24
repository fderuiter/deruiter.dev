[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/erd](../README.md) / renderWarehouseReference

# Function: renderWarehouseReference()

> **renderWarehouseReference**(`schema`): `string`

Renders the warehouse reference page: the ERD, every fact's grain and
keys, every dimension's keys and history, the silver tables, and the
columns of each gold table.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/interfaces/WarehouseSchema.md)

The schema, normally `WAREHOUSE_SCHEMA`.

## Returns

`string`

Markdown, ending in a newline.
