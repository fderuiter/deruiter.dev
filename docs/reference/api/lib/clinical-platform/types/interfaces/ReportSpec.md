[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ReportSpec

# Interface: ReportSpec

A declarative report: what it shows and who it is for, as data. One
shared renderer draws every report, so no report computes a metric
itself; each value comes from the metric registry.

## Properties

### audience

> `readonly` **audience**: `string`

Who reads the report, for example `Study leadership`.

***

### dimensions

> `readonly` **dimensions**: readonly [`MetricDimensionId`](../type-aliases/MetricDimensionId.md)[]

Dimensions the metrics are grouped by, in row order.

***

### filters

> `readonly` **filters**: readonly [`MetricFilter`](MetricFilter.md)[]

Filters applied to every metric, replacing each metric's default on the same dimension.

***

### id

> `readonly` **id**: `string`

Stable report id in kebab case, for example `study-status`.

***

### metrics

> `readonly` **metrics**: readonly `string`[]

Ids of the registry metrics shown, in column order.

***

### owner

> `readonly` **owner**: `string`

Accountable owner (a role, not a person).

***

### purpose

> `readonly` **purpose**: `string`

What decision the report supports, in one or two sentences.

***

### refreshSlaHours

> `readonly` **refreshSlaHours**: `number`

Maximum age of the data, in hours, before the report is stale.

***

### signOff

> `readonly` **signOff**: [`ReportSignOff`](ReportSignOff.md) \| `null`

Owner's sign-off; required for a certified report, otherwise `null`.

***

### tier

> `readonly` **tier**: [`ReportTier`](../type-aliases/ReportTier.md)

Certification tier.

***

### title

> `readonly` **title**: `string`

Display title.

***

### version

> `readonly` **version**: `string`

Semantic version of the spec.

***

### visual

> `readonly` **visual**: [`ReportVisual`](../type-aliases/ReportVisual.md)

How the numbers are shown.
