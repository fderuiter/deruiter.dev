[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/rtf](../README.md) / writeTableRtf

# Function: writeTableRtf()

> **writeTableRtf**(`table`): `string`

Writes one table as RTF 1.x.

The output depends only on the table, so the same run always gives the
same bytes. Lines end with LF, which RTF readers ignore.

## Parameters

### table

[`TlfTable`](../../../../types/interfaces/TlfTable.md)

A table from `buildTlfOutputs`.

## Returns

`string`

The document as text, plain ASCII.
