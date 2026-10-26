[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / DsqlLoadPlan

# Interface: DsqlLoadPlan

Everything a runner sends to Aurora DSQL to load a set of warehouse
tables, in order, inside DSQL's limits: each DDL statement runs in its own
transaction, and each insert modifies far fewer than 3,000 rows (ADR 0070).

## Properties

### create

> `readonly` **create**: readonly `string`[]

`CREATE SCHEMA` and `CREATE TABLE` statements, referenced tables first.

***

### csvBytes

> `readonly` **csvBytes**: `number`

Size of the loaded rows as CSV, in bytes: a floor for DSQL storage, against its 1 GB free quota.

***

### drop

> `readonly` **drop**: readonly `string`[]

`DROP TABLE IF EXISTS` statements, dependants first.

***

### inserts

> `readonly` **inserts**: readonly [`DsqlInsertBatch`](DsqlInsertBatch.md)[]

Inserts in table order, so every foreign key's target is loaded first.

***

### parity

> `readonly` **parity**: readonly [`DsqlTableParity`](DsqlTableParity.md)[]

Expected contents of each table after the load.

***

### schemaVersion

> `readonly` **schemaVersion**: `string`

Warehouse schema version loaded.
