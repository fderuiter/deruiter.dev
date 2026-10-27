[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/recorded](../README.md) / CoreFinding

# Interface: CoreFinding

One CORE rule's findings on one dataset or USDM entity, in one view.

## Properties

### addedByScenario

> `readonly` **addedByScenario**: `number`

Findings beyond the default view's for the same rule and dataset.

***

### coreId

> `readonly` **coreId**: `string`

***

### count

> `readonly` **count**: `number`

***

### dataset

> `readonly` **dataset**: `string`

***

### examples

> `readonly` **examples**: readonly [`CoreFindingExample`](CoreFindingExample.md)[]

***

### explanation?

> `readonly` `optional` **explanation?**: [`RecordedExplanation`](RecordedExplanation.md)

***

### rule

> `readonly` **rule**: [`RecordedRule`](RecordedRule.md)

***

### target

> `readonly` **target**: `"sdtm"` \| `"usdm"`
