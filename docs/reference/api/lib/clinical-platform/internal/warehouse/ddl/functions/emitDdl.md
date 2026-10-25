[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/warehouse/ddl](../README.md) / emitDdl

# Function: emitDdl()

> **emitDdl**(`schema`, `dialect`): `string`

Writes the warehouse DDL for one SQL dialect: schemas, then every table
with its columns, primary key, unique keys and foreign keys, then its
table and column descriptions (`COMMENT ON` in DuckDB and PostgreSQL,
`MS_Description` extended properties in T-SQL). Tables come in schema
order, so every foreign key's target exists before it is referenced.

## Parameters

### schema

[`WarehouseSchema`](../../../../types/warehouse/interfaces/WarehouseSchema.md)

The schema, normally `WAREHOUSE_SCHEMA`.

### dialect

[`SqlDialect`](../../../../types/platform/type-aliases/SqlDialect.md)

`duckdb`, `postgres` or `tsql`.

## Returns

`string`

The DDL script, ending in a newline.
