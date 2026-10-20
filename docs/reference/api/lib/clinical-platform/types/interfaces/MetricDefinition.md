[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricDefinition

# Interface: MetricDefinition

One governed metric in the semantic layer. Defined once and compiled to
every consumer; no dashboard computes a metric itself.

## Properties

### aggregation

> `readonly` **aggregation**: `"count"` \| `"sum"` \| `"avg"` \| `"ratio"` \| `"median"`

Aggregation applied to the measure.

***

### certified

> `readonly` **certified**: `boolean`

Whether the metric is certified for use in certified reports.

***

### denominator

> `readonly` **denominator**: `string` \| `null`

Denominator expression, for `ratio` metrics only.

***

### description

> `readonly` **description**: `string`

Business definition in one or two sentences.

***

### expression

> `readonly` **expression**: `string`

Measure expression, in the registry's own expression syntax.

***

### grain

> `readonly` **grain**: [`MetricGrain`](../type-aliases/MetricGrain.md)

Finest grain the metric is valid at.

***

### id

> `readonly` **id**: `string`

Stable metric id, for example `screen_failure_rate`.

***

### name

> `readonly` **name**: `string`

Display name.

***

### owner

> `readonly` **owner**: `string`

Accountable owner (a role).

***

### sourceProductId

> `readonly` **sourceProductId**: `string`

Id of the gold data product the metric reads.

***

### unit

> `readonly` **unit**: `string`

Unit for display, for example `%` or `days`.

***

### version

> `readonly` **version**: `string`

Semantic version of the definition.
