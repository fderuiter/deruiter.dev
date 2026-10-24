[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/adam/shared](../README.md) / AdamLayout

# Interface: AdamLayout

How an ADaM dataset is classified and what one record represents.

## Properties

### class

> `readonly` **class**: `string`

ADaM class, for example `BDS`.

***

### codelists?

> `readonly` `optional` **codelists?**: `Readonly`\<`Record`\<`string`, [`CodelistId`](../../../conformance/terminology/type-aliases/CodelistId.md)\>\>

Codelists of this dataset's own variables, over the shared ones.

***

### structure

> `readonly` **structure**: `string`

What one record represents.

***

### subClass?

> `readonly` `optional` **subClass?**: `string`

ADaM subclass, for example `TIME-TO-EVENT`.
