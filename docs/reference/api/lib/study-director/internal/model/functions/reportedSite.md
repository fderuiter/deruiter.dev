[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/model](../README.md) / reportedSite

# Function: reportedSite()

> **reportedSite**(`state`, `siteId`): [`SiteAuditReport`](../../../types/interfaces/SiteAuditReport.md) \| `null`

What the dashboard is being told about one site: each count scaled by the
share of problems the site surfaces (all of them inside an audit window).
Training is reported as current unless the site surfaces that it is not.
Returns null for an unknown site. The true state is what `auditSite`
reports.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### siteId

`string`

## Returns

[`SiteAuditReport`](../../../types/interfaces/SiteAuditReport.md) \| `null`
