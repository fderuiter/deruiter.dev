[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/dsql](../README.md) / planDsqlLoad

# Function: planDsqlLoad()

> **planDsqlLoad**(`schema`, `warehouse`, `options?`): [`DsqlLoadPlan`](../../../../types/platform/interfaces/DsqlLoadPlan.md)

Plans loading warehouse tables into Aurora DSQL: drop the tables
(dependants first), create the schemas and tables in PostgreSQL syntax
with every key and check but without descriptions, then insert the rows
in table order with parameterised statements of at most
`maxRowsPerInsert` rows. Each statement is meant to run in its own
transaction, which is what DSQL requires of DDL and what keeps each
insert under its 3,000-row limit.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/warehouse/interfaces/WarehouseSchema.md)

The tables to load, in schema order, such as the gold layer.

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

Rows from `buildWarehouse`.

### options?

[`DsqlLoadOptions`](../../../../types/platform/interfaces/DsqlLoadOptions.md) = `{}`

Batch size.

## Returns

[`DsqlLoadPlan`](../../../../types/platform/interfaces/DsqlLoadPlan.md)

The plan, with each table's expected row count, fingerprint and read-back query.
