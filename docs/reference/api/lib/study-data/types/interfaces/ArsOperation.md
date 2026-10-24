[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsOperation

# Interface: ArsOperation

One operation of a method, which produces one result per group.

## Properties

### id

> `readonly` **id**: `string`

Stable id, for example `Mth_Summ_Mean`.

***

### label

> `readonly` **label**: `string`

Label, including the display precision rule.

***

### name

> `readonly` **name**: `string`

Short name, for example `Mean`.

***

### order

> `readonly` **order**: `number`

Position within the method, from 1.

***

### referencedOperationRelationships?

> `readonly` `optional` **referencedOperationRelationships?**: readonly [`ArsOperationRelationship`](ArsOperationRelationship.md)[]

Operations of other analyses whose results this one uses.

***

### resultPattern?

> `readonly` `optional` **resultPattern?**: `string`

Display pattern, for example `XX` or `(XX.X)`, when it does not depend on the data.
