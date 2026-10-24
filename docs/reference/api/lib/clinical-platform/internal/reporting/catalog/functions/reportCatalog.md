[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/catalog](../README.md) / reportCatalog

# Function: reportCatalog()

> **reportCatalog**(`specs`, `options?`): [`ReportCatalogEntry`](../../../../types/interfaces/ReportCatalogEntry.md)[]

The catalog entries for some report specs, in the order given.

## Parameters

### specs

readonly [`ReportSpec`](../../../../types/interfaces/ReportSpec.md)[]

The reports.

### options?

[`ReportCatalogOptions`](../interfaces/ReportCatalogOptions.md) = `{}`

Last refresh, usage counters and the registry.

## Returns

[`ReportCatalogEntry`](../../../../types/interfaces/ReportCatalogEntry.md)[]

One entry per report. A report with no counter has `null`
  views when no usage was supplied at all, and 0 when usage was supplied
  without it.
