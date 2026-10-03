[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/sites](../README.md) / travel

# Function: travel()

> **travel**(`world`, `mapId`): [`SiteResult`](../../../types/type-aliases/SiteResult.md)\<\{ `report`: [`SiteVisitReport`](../../../types/interfaces/SiteVisitReport.md) \| `null`; \}\>

Fast travel by car to a site or back to the office. Driving costs its
minutes and a point of energy per ten of them. Leaving a site writes the
visit up first (see `closeVisit`). Arriving at a site starts a visit and
counts it toward learning the coordinator; a site that would be closed by
the time the player could do anything there is refused.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### mapId

`string`

## Returns

[`SiteResult`](../../../types/type-aliases/SiteResult.md)\<\{ `report`: [`SiteVisitReport`](../../../types/interfaces/SiteVisitReport.md) \| `null`; \}\>
