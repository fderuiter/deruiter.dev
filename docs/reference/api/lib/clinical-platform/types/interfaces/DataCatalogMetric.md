[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataCatalogMetric

# Interface: DataCatalogMetric

A governed metric as the data catalog lists it (#2638).

## Properties

### description

> `readonly` **description**: `string`

***

### glossaryTerm

> `readonly` **glossaryTerm**: \{ `key`: `string`; `term`: `string`; \} \| `null`

The linked business glossary term, or `null`.

***

### id

> `readonly` **id**: `string`

***

### kind

> `readonly` **kind**: `"metric"`

***

### lineageNode

> `readonly` **lineageNode**: `string` \| `null`

Id of the metric's node in the lineage graph, or `null` when no graph was supplied.

***

### name

> `readonly` **name**: `string`

***

### owner

> `readonly` **owner**: `string`

***

### reports

> `readonly` **reports**: readonly `string`[]

Ids of the supplied reports that show the metric.

***

### sources

> `readonly` **sources**: readonly `string`[]

Ids of the data products the formula reads.

***

### status

> `readonly` **status**: [`MetricStatus`](../type-aliases/MetricStatus.md)

***

### steward

> `readonly` **steward**: `string`

***

### stewardshipDomain

> `readonly` **stewardshipDomain**: [`GovernanceDomainId`](../type-aliases/GovernanceDomainId.md)

***

### unit

> `readonly` **unit**: `string`

***

### version

> `readonly` **version**: `string`
