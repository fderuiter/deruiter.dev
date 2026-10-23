[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/lineage](../README.md) / warehouseLineage

# Function: warehouseLineage()

> **warehouseLineage**(`schema`): [`LineageEdge`](../../../../types/interfaces/LineageEdge.md)[]

Lists the warehouse's column-level lineage edges: one per source column
of every silver and gold column, in schema order. Every edge must pass
`checkLayerFlow`.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/interfaces/WarehouseSchema.md)

The schema, normally `WAREHOUSE_SCHEMA`.

## Returns

[`LineageEdge`](../../../../types/interfaces/LineageEdge.md)[]

The edges.
