[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataContract

# Interface: DataContract

A versioned data contract for one data product.

## Properties

### columns

> `readonly` **columns**: readonly [`ContractColumn`](ContractColumn.md)[]

Columns the product guarantees.

***

### id

> `readonly` **id**: `string`

Stable contract id.

***

### productId

> `readonly` **productId**: `string`

Id of the product the contract governs.

***

### sla

> `readonly` **sla**: `object`

Service levels the product promises.

#### completeness

> `readonly` **completeness**: `number`

Minimum share of required values present, from 0 to 1.

#### freshnessHours

> `readonly` **freshnessHours**: `number`

Maximum age of the newest record, in hours.

***

### version

> `readonly` **version**: `string`

Semantic version. A breaking schema change needs a major version bump.
