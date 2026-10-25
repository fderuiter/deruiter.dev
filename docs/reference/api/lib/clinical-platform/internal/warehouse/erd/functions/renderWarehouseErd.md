[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/erd](../README.md) / renderWarehouseErd

# Function: renderWarehouseErd()

> **renderWarehouseErd**(`schema`): `string`

Renders the gold layer as a Mermaid `erDiagram`: every dimension and fact
with its columns and keys, and one relationship per foreign key. A
nullable foreign key is drawn as zero-or-one on the dimension side.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/warehouse/interfaces/WarehouseSchema.md)

The schema, normally `WAREHOUSE_SCHEMA`.

## Returns

`string`

Mermaid source, without a code fence.
