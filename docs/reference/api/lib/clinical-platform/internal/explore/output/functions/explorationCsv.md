[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/output](../README.md) / explorationCsv

# Function: explorationCsv()

> **explorationCsv**(`report`): `string`

A built report as CSV: one column per grouped dimension, then one per
metric headed with its name and unit, and one row per group. Values are
unformatted numbers with full precision, so a spreadsheet can compute
with them; a value the metric does not define is empty. Lines end with
CRLF, as RFC 4180 asks.

## Parameters

### report

[`ReportData`](../../../../types/interfaces/ReportData.md)

A report from `runExploration` or `buildReport`.

## Returns

`string`

The CSV text.
