[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/workbench/load](../README.md) / workbenchLoad

# Function: workbenchLoad()

> **workbenchLoad**(`warehouse`): [`WorkbenchLoad`](../../../../types/workbench/interfaces/WorkbenchLoad.md)

The statements and files that load the gold layer into DuckDB, in order:
run `ddl`, register each file's text under its `fileName` and run its
`copy`, then run each of `settings`. Running the settings last means no
later statement can reopen file, network or extension access.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

Rows from `buildWarehouse`.

## Returns

[`WorkbenchLoad`](../../../../types/workbench/interfaces/WorkbenchLoad.md)

The load, in schema order.
