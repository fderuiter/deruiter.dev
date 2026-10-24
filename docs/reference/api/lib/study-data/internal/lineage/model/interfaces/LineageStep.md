[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/lineage/model](../README.md) / LineageStep

# Interface: LineageStep\<T\>

One level of a trace: everything linked, of which the first few are listed.

## Type Parameters

### T

`T`

## Properties

### items

> `readonly` **items**: readonly `T`[]

The first `limit` items, in dataset and row order.

***

### note?

> `readonly` `optional` **note?**: `string`

Why the level is empty or partial, in words.

***

### total

> `readonly` **total**: `number`

How many items are linked in all.
