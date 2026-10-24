[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsRowSet

# Interface: ArsRowSet

A deduplicated set of ADaM rows that results refer to. Row ids are built
by `adamRowId`: the dataset name and the values of its key variables
other than `STUDYID`, for example `ADVS:DEMO-301-0001:5`.

A set holds its own `rowIds` and every row of the sets it `includes`.
Nested sets, such as the Kaplan-Meier risk sets, use this so each row is
listed once rather than once per set it belongs to.

## Properties

### dataset

> `readonly` **dataset**: `string`

Dataset the rows belong to.

***

### id

> `readonly` **id**: `string`

Stable id, for example `RowSet_0001`.

***

### includes?

> `readonly` `optional` **includes?**: readonly `string`[]

Row sets of the same dataset whose rows this set also holds. Each one
is listed before this set, so inclusion never forms a cycle.

***

### rowIds

> `readonly` **rowIds**: readonly `string`[]

Row ids the set lists itself, in dataset order; may be empty.
