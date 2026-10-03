[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/sites](../README.md) / performCheck

# Function: performCheck()

> **performCheck**(`world`, `id`): [`SiteResult`](../../../types/type-aliases/SiteResult.md)\<\{ `learned`: [`CoordinatorTrait`](../../../types/interfaces/CoordinatorTrait.md)[]; `observation`: [`SiteObservation`](../../../types/interfaces/SiteObservation.md); \}\>

Does one check on the visit in progress. It costs the check's minutes,
energy and focus, adds what the player saw to the visit's observations,
and may reveal a hidden trait of the coordinator: which traits a check can
reveal, and from which visit, is fixed per coordinator.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### id

`"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`

## Returns

[`SiteResult`](../../../types/type-aliases/SiteResult.md)\<\{ `learned`: [`CoordinatorTrait`](../../../types/interfaces/CoordinatorTrait.md)[]; `observation`: [`SiteObservation`](../../../types/interfaces/SiteObservation.md); \}\>
