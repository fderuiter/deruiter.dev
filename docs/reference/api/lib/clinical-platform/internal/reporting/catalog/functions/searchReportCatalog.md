[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/catalog](../README.md) / searchReportCatalog

# Function: searchReportCatalog()

> **searchReportCatalog**(`entries`, `query`): [`ReportCatalogEntry`](../../../../types/interfaces/ReportCatalogEntry.md)[]

Searches catalog entries. Every word of `text` must appear in the
entry's title, purpose, audience, owner or metric names, ignoring case;
the entry's tier must be one of `tiers`; and its audience must equal
`audience`. A criterion that is absent or empty matches every entry.

## Parameters

### entries

readonly [`ReportCatalogEntry`](../../../../types/interfaces/ReportCatalogEntry.md)[]

Catalog entries.

### query

[`ReportCatalogQuery`](../../../../types/interfaces/ReportCatalogQuery.md)

The search.

## Returns

[`ReportCatalogEntry`](../../../../types/interfaces/ReportCatalogEntry.md)[]

The matching entries, in their catalog order.
