[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsOutput

# Interface: ArsOutput

One output: a numbered table or figure, its displays and its files.

## Properties

### displays

> `readonly` **displays**: readonly [`ArsOrderedDisplay`](ArsOrderedDisplay.md)[]

Displays, in order.

***

### fileSpecifications

> `readonly` **fileSpecifications**: readonly [`ArsFileSpecification`](ArsFileSpecification.md)[]

Files the output is rendered to.

***

### id

> `readonly` **id**: `string`

Stable id, for example `Out_14_1_1`.

***

### name

> `readonly` **name**: `string`

Short name, for example `Table 14.1.1`.

***

### version

> `readonly` **version**: `number`

Version, from 1.
