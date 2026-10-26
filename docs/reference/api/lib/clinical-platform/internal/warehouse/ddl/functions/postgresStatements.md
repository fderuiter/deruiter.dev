[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/ddl](../README.md) / postgresStatements

# Function: postgresStatements()

> **postgresStatements**(`schema`): `string`[]

`CREATE SCHEMA` for each layer, then `CREATE TABLE` for each table, as
separate statements without descriptions: Aurora DSQL runs one DDL
statement per transaction (ADR 0070).

## Parameters

### schema

[`WarehouseSchema`](../../../../types/warehouse/interfaces/WarehouseSchema.md)

The schema or a subset of it, in schema order.

## Returns

`string`[]

One PostgreSQL statement per element.
