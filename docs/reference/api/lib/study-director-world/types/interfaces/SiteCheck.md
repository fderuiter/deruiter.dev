[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / SiteCheck

# Interface: SiteCheck

One check: what it is, where it is done, what it costs and covers.

## Properties

### cost

> **cost**: [`ActionCost`](ActionCost.md)

***

### covers

> **covers**: [`SiteFindingField`](../type-aliases/SiteFindingField.md)[]

Parts of the site's true state the check looks at.

***

### id

> **id**: `"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`

***

### label

> **label**: `string`

***

### records

> **records**: `boolean`

True for checks of the site's records, which resolve into an audit.

***

### station

> **station**: [`StationId`](../type-aliases/StationId.md)

The station the player faces to do it.
