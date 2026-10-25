[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricDefinition

# Interface: MetricDefinition

One governed metric of the semantic layer (ADR 0066). Defined once over the
gold star schema and compiled to every consumer: the TypeScript evaluator,
SQL for three dialects, dbt MetricFlow and Power BI TMDL. No dashboard
computes a metric itself.

## Properties

### allowedDimensions

> `readonly` **allowedDimensions**: readonly [`MetricDimensionId`](../type-aliases/MetricDimensionId.md)[]

Dimensions a query may group or filter by.

***

### changeLog

> `readonly` **changeLog**: readonly [`MetricChangeLogEntry`](MetricChangeLogEntry.md)[]

Changes to the definition, oldest first; the last entry is the current version.

***

### defaultFilters

> `readonly` **defaultFilters**: readonly [`MetricFilter`](MetricFilter.md)[]

Filters applied unless a query filters the same dimension, in which case
the query's filter replaces the default.

***

### description

> `readonly` **description**: `string`

Business definition in one to three sentences.

***

### displayFolder

> `readonly` **displayFolder**: `string`

Folder the metric is listed under in BI tools, for example `Enrollment`.

***

### format

> `readonly` **format**: [`MetricFormat`](MetricFormat.md)

Display format.

***

### formula

> `readonly` **formula**: [`MetricFormula`](../type-aliases/MetricFormula.md)

How the value is computed from the gold model.

***

### glossaryTerm

> `readonly` **glossaryTerm**: `string` \| `null`

Key of the business glossary term (`CANONICAL_GLOSSARY` in
`lib/term-glossary.ts`) that defines what the metric counts, or `null`.
A certified metric must link one.

***

### grain

> `readonly` **grain**: [`MetricGrain`](../type-aliases/MetricGrain.md)

Level the value is defined at.

***

### id

> `readonly` **id**: `string`

Stable metric id in snake case, for example `screen_failure_rate`.

***

### name

> `readonly` **name**: `string`

Display name.

***

### owner

> `readonly` **owner**: `string`

Accountable owner (a role, not a person).

***

### status

> `readonly` **status**: [`MetricStatus`](../type-aliases/MetricStatus.md)

Lifecycle status.

***

### steward

> `readonly` **steward**: `string`

Data steward (a role, not a person).

***

### unit

> `readonly` **unit**: `string`

Unit of the value, for example `days` or `queries per 100 visits`.

***

### version

> `readonly` **version**: `string`

Semantic version. Changing what a certified metric computes needs a
major version bump; `checkMetricChange` enforces it.
