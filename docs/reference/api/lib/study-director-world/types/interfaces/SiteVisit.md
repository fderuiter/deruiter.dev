[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / SiteVisit

# Interface: SiteVisit

A site visit in progress.

## Properties

### arrivedAt

> **arrivedAt**: `number`

Clock minute the player arrived.

***

### checks

> **checks**: (`"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`)[]

***

### day

> **day**: `number`

Study day of the visit.

***

### mapId

> **mapId**: `string`

***

### number

> **number**: `number`

Which visit to this site this is, counting from 1.

***

### observations

> **observations**: [`SiteObservation`](SiteObservation.md)[]

***

### siteId

> **siteId**: `string`
