[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsAnalysis

# Interface: ArsAnalysis

One analysis: a method applied to a variable for an analysis set.

## Properties

### analysisSetId

> `readonly` **analysisSetId**: `string`

The population.

***

### dataset

> `readonly` **dataset**: `string`

The analysis dataset.

***

### dataSubsetId?

> `readonly` `optional` **dataSubsetId?**: `string`

The record subset, when there is one.

***

### id

> `readonly` **id**: `string`

Stable id, for example `An_14_1_1_AGE`.

***

### methodId

> `readonly` **methodId**: `string`

The method.

***

### name

> `readonly` **name**: `string`

Short description.

***

### orderedGroupings

> `readonly` **orderedGroupings**: readonly [`ArsOrderedGrouping`](ArsOrderedGrouping.md)[]

Grouping factors, in order.

***

### purpose?

> `readonly` `optional` **purpose?**: [`ArsTerm`](ArsTerm.md)

What the analysis is for, when it measures a study endpoint.

***

### rawDecimals?

> `readonly` `optional` **rawDecimals?**: `number`

Decimals the summarised data is recorded with, which set the display
precision. Present for descriptive summaries only.

***

### reason

> `readonly` **reason**: [`ArsTerm`](ArsTerm.md)

Why the analysis is performed, for example `SPECIFIED IN SAP`.

***

### referencedAnalysisOperations?

> `readonly` `optional` **referencedAnalysisOperations?**: readonly [`ArsReferencedAnalysisOperation`](ArsReferencedAnalysisOperation.md)[]

Where the results of related operations come from.

***

### results

> `readonly` **results**: readonly [`ArsOperationResult`](ArsOperationResult.md)[]

The results, one per operation and group combination.

***

### variable

> `readonly` **variable**: `string`

The analysis variable.

***

### version

> `readonly` **version**: `number`

Version, from 1.
