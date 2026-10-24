[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsOperationRelationship

# Interface: ArsOperationRelationship

A link from one operation to another whose result it uses.

## Properties

### description

> `readonly` **description**: `string`

What the relationship means.

***

### id

> `readonly` **id**: `string`

Stable id, referenced by an analysis.

***

### operationId

> `readonly` **operationId**: `string`

The operation whose result is used.

***

### referencedOperationRole

> `readonly` **referencedOperationRole**: [`ArsTerm`](ArsTerm.md)

`NUMERATOR` or `DENOMINATOR`.
