[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/html](../README.md) / writeTableHtml

# Function: writeTableHtml()

> **writeTableHtml**(`table`): `string`

Writes one table as a standalone, accessible HTML document.

The output depends only on the table, so the same run always gives the
same bytes. Lines end with LF.

## Parameters

### table

[`TlfTable`](../../../../types/interfaces/TlfTable.md)

A table from `buildTlfOutputs`.

## Returns

`string`

The document as text.
