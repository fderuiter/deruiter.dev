[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/sites](../README.md) / closeVisit

# Function: closeVisit()

> **closeVisit**(`world`): `object`

Ends the visit in progress and writes it up. When any of the site's
records were checked, the observations resolve through the domain's
`auditSite`: the dashboard shows the site's true state for the audit
window, and the write-up names what the dashboard had been hiding.
Conversations alone audit nothing. Returns a null report off a visit.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

## Returns

`object`

### report

> **report**: [`SiteVisitReport`](../../../types/interfaces/SiteVisitReport.md) \| `null`

### world

> **world**: [`WorldState`](../../../types/interfaces/WorldState.md)
