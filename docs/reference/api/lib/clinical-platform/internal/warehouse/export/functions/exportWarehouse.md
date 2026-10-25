[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/export](../README.md) / exportWarehouse

# Function: exportWarehouse()

> **exportWarehouse**(`schema`, `warehouse`): [`WarehouseExport`](../../../../types/warehouse/interfaces/WarehouseExport.md)

Exports every warehouse table as CSV with a header row and RFC 4180 quoting (fields
separated by commas, lines by LF), plus a manifest of each file's columns
with their logical, nullability, classification and Parquet types.
Dates are ISO 8601 and timestamps UTC with a `Z`; decimals carry their
declared scale. No Parquet library is needed: the manifest says how to
write each column.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/warehouse/interfaces/WarehouseSchema.md)

The schema, normally `WAREHOUSE_SCHEMA`.

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

Rows from `buildWarehouse`.

## Returns

[`WarehouseExport`](../../../../types/warehouse/interfaces/WarehouseExport.md)

The files in schema order and their manifest.
