[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / OpenLineageRunEvent

# Interface: OpenLineageRunEvent

An OpenLineage 2-0-2 `RunEvent` for one platform step: the job that
builds one dataset, its inputs, and the output with its schema, owners
and column lineage (#2637).

## Properties

### eventTime

> `readonly` **eventTime**: `string`

***

### eventType

> `readonly` **eventType**: `"COMPLETE"`

***

### inputs

> `readonly` **inputs**: readonly [`OpenLineageDataset`](OpenLineageDataset.md)[]

***

### job

> `readonly` **job**: `object`

#### facets

> `readonly` **facets**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

#### name

> `readonly` **name**: `string`

#### namespace

> `readonly` **namespace**: `string`

***

### outputs

> `readonly` **outputs**: readonly [`OpenLineageDataset`](OpenLineageDataset.md)[]

***

### producer

> `readonly` **producer**: `string`

***

### run

> `readonly` **run**: `object`

#### runId

> `readonly` **runId**: `string`

***

### schemaURL

> `readonly` **schemaURL**: `string`
