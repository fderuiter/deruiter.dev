[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / LineageNode

# Interface: LineageNode

One node of the platform lineage graph (#2637).

## Properties

### dataset

> `readonly` **dataset**: `string`

Table, dataset or product: for example `silver.edc_visit`, `sdtm.DM`,
`bronze.edc.subjects`, `semantic.metrics`, `powerbi.governed_metrics`
or `reporting.reports`.

***

### field

> `readonly` **field**: `string`

Column, variable, metric id or report id within the dataset.

***

### id

> `readonly` **id**: `string`

Stable id: the dataset and the field, joined by a dot.

***

### label

> `readonly` **label**: `string`

Name a person reads: the column, the metric's name, the report's title.

***

### method

> `readonly` **method**: `string` \| `null`

Derivation method of a study variable whose inputs the pipeline does not declare, or `null`.

***

### owners

> `readonly` **owners**: readonly `string`[]

Roles accountable for the node, owner first, to notify of a change upstream.

***

### stage

> `readonly` **stage**: [`LineageStage`](../type-aliases/LineageStage.md)

***

### type

> `readonly` **type**: `string` \| `null`

Data type of a column or variable, or `null` for a metric, measure or report.
