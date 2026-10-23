[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/check](../README.md) / checkWarehouse

# Function: checkWarehouse()

> **checkWarehouse**(`schema`, `warehouse`): [`WarehouseFinding`](../../../../types/interfaces/WarehouseFinding.md)[]

Checks a warehouse against its schema: every table and column present,
every value of its column's type, nullability and length, one row per
declared grain, unique natural keys, every foreign key resolving to its
dimension, and SCD type 2 versions that are numbered, contiguous and
non-overlapping with one current version per member.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/interfaces/WarehouseSchema.md)

The schema, normally `WAREHOUSE_SCHEMA`.

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

Rows from `buildWarehouse`.

## Returns

[`WarehouseFinding`](../../../../types/interfaces/WarehouseFinding.md)[]

Findings; empty when every invariant holds.
