[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/workbench](../README.md) / WorkbenchResult

# Interface: WorkbenchResult

The rows a query returned in the SQL workbench (#2633).

## Properties

### columns

> `readonly` **columns**: readonly [`WorkbenchResultColumn`](WorkbenchResultColumn.md)[]

***

### elapsedMs

> `readonly` **elapsedMs**: `number`

Time the engine took, in milliseconds.

***

### rowCount

> `readonly` **rowCount**: `number`

Rows the query returned, which is more than `rows` holds when truncated.

***

### rows

> `readonly` **rows**: readonly (readonly (`string` \| `null`)[])[]

Each value as text, `null` for SQL NULL, in column order.

***

### truncated

> `readonly` **truncated**: `boolean`

Whether rows past the workbench's limit were counted but not kept.
