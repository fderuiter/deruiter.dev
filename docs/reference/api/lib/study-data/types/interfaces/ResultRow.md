[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ResultRow

# Interface: ResultRow

A result's ADaM row, with the role it plays in the result.

## Extends

- [`AdamRowLocation`](AdamRowLocation.md)

## Properties

### dataset

> `readonly` **dataset**: `string`

The dataset name.

#### Inherited from

[`AdamRowLocation`](AdamRowLocation.md).[`dataset`](AdamRowLocation.md#dataset)

***

### role

> `readonly` **role**: [`ArsRowRole`](../type-aliases/ArsRowRole.md)

Why the row is linked to the result.

***

### rowId

> `readonly` **rowId**: `string`

The row id.

#### Inherited from

[`AdamRowLocation`](AdamRowLocation.md).[`rowId`](AdamRowLocation.md#rowid)

***

### rowIndex

> `readonly` **rowIndex**: `number`

Zero-based row index in that dataset.

#### Inherited from

[`AdamRowLocation`](AdamRowLocation.md).[`rowIndex`](AdamRowLocation.md#rowindex)
