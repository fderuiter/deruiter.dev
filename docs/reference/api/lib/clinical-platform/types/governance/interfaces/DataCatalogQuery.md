[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / DataCatalogQuery

# Interface: DataCatalogQuery

A search of the data catalog (#2638). An absent or empty criterion matches every entry.

## Properties

### classifications?

> `readonly` `optional` **classifications?**: readonly [`DataClassification`](../../platform/type-aliases/DataClassification.md)[]

Product classifications; set, it leaves metrics out.

***

### kinds?

> `readonly` `optional` **kinds?**: readonly (`"metric"` \| `"product"`)[]

***

### layers?

> `readonly` `optional` **layers?**: readonly [`MedallionLayer`](../../platform/type-aliases/MedallionLayer.md)[]

Product layers; set, it leaves metrics out.

***

### metricStatuses?

> `readonly` `optional` **metricStatuses?**: readonly [`MetricStatus`](../../platform/type-aliases/MetricStatus.md)[]

Metric statuses; set, it leaves products out.

***

### slaStatuses?

> `readonly` `optional` **slaStatuses?**: readonly [`CatalogSlaStatus`](../type-aliases/CatalogSlaStatus.md)[]

Product SLA statuses; set, it leaves metrics out.

***

### stewardshipDomains?

> `readonly` `optional` **stewardshipDomains?**: readonly [`GovernanceDomainId`](../type-aliases/GovernanceDomainId.md)[]

***

### text?

> `readonly` `optional` **text?**: `string`

Words that must all appear in the entry's text, ignoring case.
