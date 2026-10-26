[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/workbench](../README.md) / WorkbenchLoad

# Interface: WorkbenchLoad

Everything the SQL workbench's engine runs to become the read-only warehouse (#2633).

## Properties

### ddl

> `readonly` **ddl**: `string`

DuckDB DDL for the gold tables, with their descriptions as comments.

***

### files

> `readonly` **files**: readonly [`WorkbenchLoadFile`](WorkbenchLoadFile.md)[]

***

### settings

> `readonly` **settings**: readonly `string`[]

Settings applied last, from `WORKBENCH_ENGINE_SETTINGS`.
