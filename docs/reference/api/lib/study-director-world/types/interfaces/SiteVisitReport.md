[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / SiteVisitReport

# Interface: SiteVisitReport

The write-up of a finished visit, resolved through `auditSite`.

## Properties

### audited

> **audited**: `boolean`

False when only conversations happened, so nothing was audited.

***

### checks

> **checks**: (`"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`)[]

***

### day

> **day**: `number`

***

### findings

> **findings**: [`SiteFinding`](SiteFinding.md)[]

***

### learned

> **learned**: [`CoordinatorTrait`](CoordinatorTrait.md)[]

Coordinator traits learned on this visit.

***

### siteId

> **siteId**: `string`

***

### siteName

> **siteName**: `string`

***

### unchecked

> **unchecked**: `string`[]

Parts of the site nobody looked at this visit.

***

### verdict

> **verdict**: `string`

One line on how honest the site's reporting turned out to be.
