[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / DataCatalogFacets

# Interface: DataCatalogFacets

Counts of catalog entries by each facet (#2638): every value of each facet
in its defined order, including values no entry takes.

## Properties

### classifications

> `readonly` **classifications**: readonly [`CatalogFacetCount`](CatalogFacetCount.md)\<[`DataClassification`](../../platform/type-aliases/DataClassification.md)\>[]

***

### kinds

> `readonly` **kinds**: readonly [`CatalogFacetCount`](CatalogFacetCount.md)\<`"metric"` \| `"product"`\>[]

***

### layers

> `readonly` **layers**: readonly [`CatalogFacetCount`](CatalogFacetCount.md)\<[`MedallionLayer`](../../platform/type-aliases/MedallionLayer.md)\>[]

***

### metricStatuses

> `readonly` **metricStatuses**: readonly [`CatalogFacetCount`](CatalogFacetCount.md)\<[`MetricStatus`](../../platform/type-aliases/MetricStatus.md)\>[]

***

### slaStatuses

> `readonly` **slaStatuses**: readonly [`CatalogFacetCount`](CatalogFacetCount.md)\<[`CatalogSlaStatus`](../type-aliases/CatalogSlaStatus.md)\>[]

***

### stewardshipDomains

> `readonly` **stewardshipDomains**: readonly [`CatalogFacetCount`](CatalogFacetCount.md)\<[`GovernanceDomainId`](../type-aliases/GovernanceDomainId.md)\>[]
