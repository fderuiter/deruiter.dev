[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/workbench](../README.md) / WorkbenchLoadFile

# Interface: WorkbenchLoadFile

One gold table's rows, ready for the SQL workbench's engine to load (#2633).

## Properties

### copy

> `readonly` **copy**: `string`

The statement that copies the file into its table.

***

### fileName

> `readonly` **fileName**: `string`

Name the CSV is registered under in the engine's virtual file system.

***

### table

> `readonly` **table**: `string`

Qualified table name, for example `gold.fct_query`.

***

### text

> `readonly` **text**: `string`

The rows as CSV, from `exportWarehouse`.
