[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsAnalysisMethod

# Interface: ArsAnalysisMethod

A statistical method: a named, ordered list of operations.

## Properties

### description

> `readonly` **description**: `string`

What the method computes, in words.

***

### id

> `readonly` **id**: `string`

Stable id, for example `Mth_Summ`.

***

### label

> `readonly` **label**: `string`

Label for displays.

***

### name

> `readonly` **name**: `string`

Short name.

***

### operations

> `readonly` **operations**: readonly [`ArsOperation`](ArsOperation.md)[]

Operations, in order.
