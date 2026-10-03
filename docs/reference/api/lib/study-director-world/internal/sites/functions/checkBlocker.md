[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/sites](../README.md) / checkBlocker

# Function: checkBlocker()

> **checkBlocker**(`world`, `id`): [`SiteRefusal`](../../../types/type-aliases/SiteRefusal.md) \| `null`

Why a check cannot be done right now, or null when it can. Checks happen
once per visit, inside the site's hours, while the player has the focus
for them; the PI is only in until mid-afternoon.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### id

`"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`

## Returns

[`SiteRefusal`](../../../types/type-aliases/SiteRefusal.md) \| `null`
