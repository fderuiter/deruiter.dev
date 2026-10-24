[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/model](../README.md) / LineageRecord

# Interface: LineageRecord

One record of a dataset, as a trace lists it.

## Properties

### dataset

> `readonly` **dataset**: `string`

***

### key

> `readonly` **key**: `string`

The record's key values other than STUDYID, for example `DEMO-301-0001 · 3`.

***

### layer

> `readonly` **layer**: [`DataLayer`](../../../../types/type-aliases/DataLayer.md)

***

### relation

> `readonly` **relation**: [`LineageRelation`](../type-aliases/LineageRelation.md)

***

### row

> `readonly` **row**: `number`

Zero-based row index.

***

### summary

> `readonly` **summary**: `string`

A few of the record's own values, for example `VSTESTCD SYSBP · VSORRES 141.2`.
