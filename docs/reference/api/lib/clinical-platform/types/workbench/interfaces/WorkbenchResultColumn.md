[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/workbench](../README.md) / WorkbenchResultColumn

# Interface: WorkbenchResultColumn

One column of a query's result in the SQL workbench (#2633).

## Properties

### name

> `readonly` **name**: `string`

***

### numeric

> `readonly` **numeric**: `boolean`

Whether the column holds numbers, so it aligns right and exports unquoted.

***

### type

> `readonly` **type**: `string`

The engine's type for the column, for example `Int64` or `Utf8`.
