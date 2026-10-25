[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/workbench](../README.md) / WorkbenchQuery

# Interface: WorkbenchQuery

A saved query in the SQL workbench's library (#2633).

## Properties

### description

> `readonly` **description**: `string`

What the query answers and how.

***

### dialects

> `readonly` **dialects**: `Readonly`\<`Record`\<[`SqlDialect`](../../platform/type-aliases/SqlDialect.md), `string`\>\> \| `null`

A metric query in every dialect the compiler writes; otherwise `null`.

***

### dimensions

> `readonly` **dimensions**: readonly [`MetricDimensionId`](../../platform/type-aliases/MetricDimensionId.md)[]

Dimensions a metric query groups by; empty for an example.

***

### id

> `readonly` **id**: `string`

Stable id, in kebab case.

***

### kind

> `readonly` **kind**: `"metric"` \| `"example"`

A worked example, or the generated SQL behind a governed metric.

***

### metricId

> `readonly` **metricId**: `string` \| `null`

Id of the governed metric, for a metric query; otherwise `null`.

***

### sql

> `readonly` **sql**: `string`

The query in DuckDB SQL, which the workbench runs.

***

### tables

> `readonly` **tables**: readonly `string`[]

Qualified names of the tables the query reads.

***

### techniques

> `readonly` **techniques**: readonly `string`[]

SQL techniques the query shows, for example `window functions`.

***

### title

> `readonly` **title**: `string`
