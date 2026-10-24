[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsGroupingFactor

# Interface: ArsGroupingFactor

A factor results are grouped by, such as treatment or system organ class.
A data-driven factor has no pre-specified groups: results carry the
observed value as `groupValue` instead of a `groupId`.

## Properties

### dataDriven

> `readonly` **dataDriven**: `boolean`

Whether groups come from the observed values.

***

### groupingDataset

> `readonly` **groupingDataset**: `string`

Dataset the grouping variable is read from.

***

### groupingVariable

> `readonly` **groupingVariable**: `string`

The grouping variable.

***

### groups

> `readonly` **groups**: readonly [`ArsGroup`](../type-aliases/ArsGroup.md)[]

Pre-specified groups, in display order; empty when data-driven.

***

### id

> `readonly` **id**: `string`

Stable id, for example `AnlsGrouping_TRT01A`.

***

### label

> `readonly` **label**: `string`

Label for displays.

***

### name

> `readonly` **name**: `string`

Short name.
