[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ReportCatalogEntry

# Interface: ReportCatalogEntry

One entry of the report catalog.

## Properties

### audience

> `readonly` **audience**: `string`

Audience.

***

### id

> `readonly` **id**: `string`

Report id.

***

### lastRefresh

> `readonly` **lastRefresh**: `string` \| `null`

ISO 8601 data cut of the last refresh, or `null` when not known.

***

### metricNames

> `readonly` **metricNames**: readonly `string`[]

Names of the metrics shown.

***

### owner

> `readonly` **owner**: `string`

Owner.

***

### purpose

> `readonly` **purpose**: `string`

Purpose.

***

### refreshSlaHours

> `readonly` **refreshSlaHours**: `number`

Refresh SLA in hours.

***

### tier

> `readonly` **tier**: [`ReportTier`](../type-aliases/ReportTier.md)

Tier.

***

### title

> `readonly` **title**: `string`

Title.

***

### version

> `readonly` **version**: `string`

Spec version.

***

### views

> `readonly` **views**: `number` \| `null`

Recorded views, or `null` when no usage count was supplied.

***

### visual

> `readonly` **visual**: [`ReportVisual`](../type-aliases/ReportVisual.md)

Visual.
