[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/check](../README.md) / visualFitsGrouping

# Function: visualFitsGrouping()

> **visualFitsGrouping**(`visual`, `dimensions`): `boolean`

Whether a visual can draw a grouping, by the rule `checkReportSpec`
applies; the explorer offers only the visuals that pass it.

## Parameters

### visual

[`ReportVisual`](../../../../types/platform/type-aliases/ReportVisual.md)

The visual.

### dimensions

readonly `string`[]

The dimensions grouped by.

## Returns

`boolean`

`true` when the visual fits.
