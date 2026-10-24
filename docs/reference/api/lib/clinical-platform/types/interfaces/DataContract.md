[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataContract

# Interface: DataContract

A versioned data contract for one data product.

## Properties

### id

> `readonly` **id**: `string`

Stable contract id.

***

### objects

> `readonly` **objects**: readonly [`ContractObject`](ContractObject.md)[]

Tables or datasets the contract covers.

***

### productId

> `readonly` **productId**: `string`

Id of the product the contract governs.

***

### retention

> `readonly` **retention**: [`DataRetention`](DataRetention.md)

Retention period.

***

### sla

> `readonly` **sla**: [`DataContractSla`](DataContractSla.md)

Service levels the product promises.

***

### version

> `readonly` **version**: `string`

Semantic version. A breaking change (a removed or retyped column, a
weaker service level) needs a major version bump, an additive one at
least a minor bump.
