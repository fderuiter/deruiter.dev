[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/workbench/schema](../README.md) / workbenchSchema

# Function: workbenchSchema()

> **workbenchSchema**(`products`, `contracts`, `warehouse`): [`WorkbenchTable`](../../../../types/interfaces/WorkbenchTable.md)[]

The gold tables the workbench loads, in schema order, each with its
contract's columns and governance and its row count.

Every visitor can read what the workbench loads, so a restricted column
must never reach it. The function refuses rather than drop the column
silently: a restricted column in gold is a contract decision to revisit.

## Parameters

### products

readonly [`DataProduct`](../../../../types/interfaces/DataProduct.md)[]

The data products, from `dataProducts`.

### contracts

readonly [`DataContract`](../../../../types/interfaces/DataContract.md)[]

The contracts in force, from `dataContracts`.

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

The warehouse the rows are counted in.

## Returns

[`WorkbenchTable`](../../../../types/interfaces/WorkbenchTable.md)[]

The tables.

## Throws

Error when a gold column is classified restricted, or a gold
  table has no product or contract.
