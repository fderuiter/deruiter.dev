[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/row-sets](../README.md) / RowSetRegistry

# Class: RowSetRegistry

Collects the row sets of one reporting event, numbered in first-use order.

## Constructors

### Constructor

> **new RowSetRegistry**(): `RowSetRegistry`

#### Returns

`RowSetRegistry`

## Methods

### all()

> **all**(): readonly [`ArsRowSet`](../../../../types/interfaces/ArsRowSet.md)[]

Every set, in first-use order.

#### Returns

readonly [`ArsRowSet`](../../../../types/interfaces/ArsRowSet.md)[]

***

### reference()

> **reference**(`dataset`, `rowIndexes`, `role`): [`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`

A reference to the set holding these rows, created on first use.

#### Parameters

##### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

##### rowIndexes

readonly `number`[]

##### role

[`ArsRowRole`](../../../../types/type-aliases/ArsRowRole.md)

#### Returns

[`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`

`null` when there are no rows.
