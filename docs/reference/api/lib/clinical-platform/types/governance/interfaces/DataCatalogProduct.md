[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / DataCatalogProduct

# Interface: DataCatalogProduct

A data product as the data catalog lists it (#2638).

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../../platform/type-aliases/DataClassification.md)

***

### consumers

> `readonly` **consumers**: readonly [`DataProductConsumer`](../../platform/interfaces/DataProductConsumer.md)[]

***

### contractId

> `readonly` **contractId**: `string`

***

### contractVersion

> `readonly` **contractVersion**: `string`

***

### description

> `readonly` **description**: `string`

***

### dqRules

> `readonly` **dqRules**: `number`

Data quality rules that checked something in the product.

***

### dqScore

> `readonly` **dqScore**: `number` \| `null`

Data quality score from 0 to 1, or `null` when no rule checked the product or no assessment was supplied.

***

### id

> `readonly` **id**: `string`

***

### kind

> `readonly` **kind**: `"product"`

***

### layer

> `readonly` **layer**: [`MedallionLayer`](../../platform/type-aliases/MedallionLayer.md)

***

### lineageDatasets

> `readonly` **lineageDatasets**: readonly `string`[]

Datasets of the lineage graph the product publishes; empty when no graph was supplied.

***

### name

> `readonly` **name**: `string`

***

### owner

> `readonly` **owner**: `string`

***

### personalHealthData

> `readonly` **personalHealthData**: `boolean`

***

### retention

> `readonly` **retention**: [`DataRetention`](../../platform/interfaces/DataRetention.md)

***

### sla

> `readonly` **sla**: [`DataContractSla`](../../platform/interfaces/DataContractSla.md)

***

### slaFindings

> `readonly` **slaFindings**: readonly `string`[]

Messages of the contract findings at the last check; empty when met or unchecked.

***

### slaStatus

> `readonly` **slaStatus**: [`CatalogSlaStatus`](../type-aliases/CatalogSlaStatus.md)

***

### sourceDomain

> `readonly` **sourceDomain**: `string`

Source system or mart, the product's own `domain`, for example `EDC` or `Operations mart`.

***

### steward

> `readonly` **steward**: `string`

***

### stewardshipDomain

> `readonly` **stewardshipDomain**: [`GovernanceDomainId`](../type-aliases/GovernanceDomainId.md)

***

### upstream

> `readonly` **upstream**: readonly `string`[]
