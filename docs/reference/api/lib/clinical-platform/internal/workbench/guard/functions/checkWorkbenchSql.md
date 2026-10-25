[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/workbench/guard](../README.md) / checkWorkbenchSql

# Function: checkWorkbenchSql()

> **checkWorkbenchSql**(`sql`): [`WorkbenchSqlFinding`](../../../../types/workbench/interfaces/WorkbenchSqlFinding.md)[]

Checks that SQL typed into the workbench is one read-only query. It
catches what the engine settings would refuse anyway, earlier and in
plain words; it is not the boundary itself.

## Parameters

### sql

`string`

The text as typed.

## Returns

[`WorkbenchSqlFinding`](../../../../types/workbench/interfaces/WorkbenchSqlFinding.md)[]

What stops the text from running; empty when it may run.
