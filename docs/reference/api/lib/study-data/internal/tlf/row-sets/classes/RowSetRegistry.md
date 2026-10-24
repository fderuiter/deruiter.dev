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

***

### union()

> **union**(`dataset`, `rowIndexes`, `included`, `role`): [`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`

A reference to the set holding these rows and every row of the
included sets, created on first use. Included sets are already in the
registry, so they are listed before the set that includes them.

#### Parameters

##### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

##### rowIndexes

readonly `number`[]

##### included

readonly ([`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`)[]

References to sets of the same dataset; `null`
  entries are skipped.

##### role

[`ArsRowRole`](../../../../types/type-aliases/ArsRowRole.md)

#### Returns

[`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`

`null` when there are no rows and nothing to include, and the
  included set itself when it is the only content.

#### Throws

RangeError when an included set is not in the registry or
  belongs to another dataset.
