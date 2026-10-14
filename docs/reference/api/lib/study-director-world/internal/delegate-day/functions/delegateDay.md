[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/delegate-day](../README.md) / delegateDay

# Function: delegateDay()

> **delegateDay**(`world`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `report`: [`OvernightReport`](../../../types/interfaces/OvernightReport.md); `visit`: [`SiteVisitReport`](../../../types/interfaces/SiteVisitReport.md) \| `null`; \}\>

Delegates the whole day (#2092): the team settles the inbox without the
player, then the day ends as if they went home. Each waiting message gets
the team's least-effort answer, undocumented, unless a seeded draw lets it
slide, when its `ifIgnored` fallout lands instead. Every team member
trusts the player a little less for being absent. The draws use their own
stream of the seed, keyed by day, so the same seed and state always
delegate the same way and nothing else in the run moves.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `report`: [`OvernightReport`](../../../types/interfaces/OvernightReport.md); `visit`: [`SiteVisitReport`](../../../types/interfaces/SiteVisitReport.md) \| `null`; \}\>
