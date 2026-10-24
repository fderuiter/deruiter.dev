[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsRowSet

# Interface: ArsRowSet

A deduplicated set of ADaM rows that results refer to. Row ids are built
by `adamRowId`: the dataset name and the values of its key variables
other than `STUDYID`, for example `ADVS:DEMO-301-0001:5`.

## Properties

### dataset

> `readonly` **dataset**: `string`

Dataset the rows belong to.

***

### id

> `readonly` **id**: `string`

Stable id, for example `RowSet_0001`.

***

### rowIds

> `readonly` **rowIds**: readonly `string`[]

Row ids, in dataset order.
