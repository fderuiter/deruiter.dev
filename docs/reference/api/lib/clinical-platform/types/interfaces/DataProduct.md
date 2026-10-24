[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DataProduct

# Interface: DataProduct

A governed data product: a dataset with an owner, a contract and consumers.

## Properties

### classification

> `readonly` **classification**: [`DataClassification`](../type-aliases/DataClassification.md)

Highest classification of any column the product holds.

***

### consumers

> `readonly` **consumers**: readonly [`DataProductConsumer`](DataProductConsumer.md)[]

Known consumers: downstream products and governed metrics.

***

### contractId

> `readonly` **contractId**: `string`

Id of the contract currently in force.

***

### description

> `readonly` **description**: `string`

One sentence on what the product holds.

***

### domain

> `readonly` **domain**: `string`

Business domain, for example `EDC` or `Operations mart`.

***

### id

> `readonly` **id**: `string`

Stable product id: the qualified table name for a warehouse table, for
example `silver.edc_subject`, or `STUDY_DATA_PRODUCT_ID`.

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

### personalHealthData

> `readonly` **personalHealthData**: `boolean`

Whether rows describe study subjects, which makes the product personal
health data however its columns are classified. The data here is
synthetic; the label is the one the real data would carry.

***

### steward

> `readonly` **steward**: `string`

Data steward (a role, not a person).

***

### upstream

> `readonly` **upstream**: readonly `string`[]

What the product is built from: other product ids, bronze feeds such as
`bronze.edc.subjects`, or the USDM study definition the Study Data
Pipeline reads, as `usdm.<study id>`.
