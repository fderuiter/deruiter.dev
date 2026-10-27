[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/win-evaluate](../README.md) / WinRatioInput

# Interface: WinRatioInput

What the win-ratio evaluator needs from the engine for one analysis.

## Properties

### adsl

> `readonly` **adsl**: [`Dataset`](../../../../types/interfaces/Dataset.md)

***

### data

> `readonly` **data**: [`Dataset`](../../../../types/interfaces/Dataset.md)

***

### factors

> `readonly` **factors**: readonly [`ArsGroupingFactor`](../../../../types/interfaces/ArsGroupingFactor.md)[]

Every grouping of the analysis, in order.

***

### population

> `readonly` **population**: readonly [`RecordContext`](../../where/interfaces/RecordContext.md)[]

ADSL records of the analysis set.

***

### records

> `readonly` **records**: readonly [`RecordContext`](../../where/interfaces/RecordContext.md)[]

ADHCE records of the analysis set and data subset.

***

### registry

> `readonly` **registry**: [`RowSetRegistry`](../../row-sets/classes/RowSetRegistry.md)

***

### spec

> `readonly` **spec**: [`AnalysisSpec`](../../plan/type-aliases/AnalysisSpec.md)
