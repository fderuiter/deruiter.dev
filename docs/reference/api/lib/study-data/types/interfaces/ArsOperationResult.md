[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsOperationResult

# Interface: ArsOperationResult

One result: the value of one operation for one combination of groups.
`id` and `rowReferences` extend the ARS 1.0 shape, so a displayed cell
can name its results and each result the rows that produced it.

## Properties

### formattedValue

> `readonly` **formattedValue**: `string`

The value as displayed, `NE` when not estimable.

***

### id

> `readonly` **id**: `string`

Stable id, for example `An_14_1_1_AGE.004`.

***

### operationId

> `readonly` **operationId**: `string`

The operation that produced it.

***

### rawValue?

> `readonly` `optional` **rawValue?**: `string`

The unrounded value as text; absent when not estimable.

***

### resultGroups

> `readonly` **resultGroups**: readonly [`ArsResultGroup`](ArsResultGroup.md)[]

The groups it belongs to, one per grouping with results by group.

***

### rowReferences

> `readonly` **rowReferences**: readonly [`ArsRowReference`](ArsRowReference.md)[]

The ADaM rows the value was computed from.
