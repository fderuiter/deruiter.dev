[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DqAssessment

# Interface: DqAssessment

Data quality results and scorecards at one data cut (#2636).

## Properties

### byDimension

> `readonly` **byDimension**: readonly [`DqScore`](DqScore.md)[]

Scores by dimension, in DAMA order.

***

### byProduct

> `readonly` **byProduct**: readonly [`DqScore`](DqScore.md)[]

Scores by data product, in product id order.

***

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut.

***

### overall

> `readonly` **overall**: [`DqScore`](DqScore.md)

***

### results

> `readonly` **results**: readonly [`DqRuleResult`](DqRuleResult.md)[]

One result per rule, in rule order.
