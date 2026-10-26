[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/workbench/output](../README.md) / workbenchResultCsv

# Function: workbenchResultCsv()

> **workbenchResultCsv**(`result`): `string`

A query's result as CSV: a header of column names, then one line per row
the workbench kept. Numeric values are written as the engine returned
them, text is quoted where it needs to be and made safe to open in a
spreadsheet, and SQL NULL is an empty field. Lines end with CRLF, as
RFC 4180 asks.

## Parameters

### result

[`WorkbenchResult`](../../../../types/workbench/interfaces/WorkbenchResult.md)

A result the workbench's engine returned.

## Returns

`string`

The CSV text.
