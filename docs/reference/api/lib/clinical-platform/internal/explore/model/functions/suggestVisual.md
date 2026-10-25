[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/model](../README.md) / suggestVisual

# Function: suggestVisual()

> **suggestVisual**(`dimensions`, `rowCount`): [`ReportVisual`](../../../../types/platform/type-aliases/ReportVisual.md)

The visual that suits the shape of a result: one number for no grouping,
a line over months, bars for a short list, and a table for a long list
or two dimensions.

## Parameters

### dimensions

readonly [`MetricDimensionId`](../../../../types/platform/type-aliases/MetricDimensionId.md)[]

The dimensions grouped by.

### rowCount

`number`

How many rows the result has.

## Returns

[`ReportVisual`](../../../../types/platform/type-aliases/ReportVisual.md)

The visual.
