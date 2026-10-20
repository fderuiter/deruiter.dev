[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataProduct

# Interface: DataProduct

A governed data product: a dataset with an owner, a contract and consumers.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../type-aliases/DataClassification.md)

Data classification.

***

### contractId

> `readonly` **contractId**: `string`

Id of the contract currently in force.

***

### description

> `readonly` **description**: `string`

One sentence on what the product holds.

***

### id

> `readonly` **id**: `string`

Stable product id.

***

### layer

> `readonly` **layer**: [`MedallionLayer`](../type-aliases/MedallionLayer.md)

Medallion layer the product is published in.

***

### name

> `readonly` **name**: `string`

Display name.

***

### owner

> `readonly` **owner**: `string`

Accountable business owner (a role, not a person).

***

### steward

> `readonly` **steward**: `string`

Data steward (a role, not a person).

***

### upstream

> `readonly` **upstream**: readonly `string`[]

Ids of the products this one is built from.
