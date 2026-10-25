[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DqTrendPoint

# Interface: DqTrendPoint

The data quality scorecard as it read at the end of one week (#2636).

## Properties

### byDimension

> `readonly` **byDimension**: readonly [`DqScore`](DqScore.md)[]

Scores by dimension, in DAMA order.

***

### failingRuleIds

> `readonly` **failingRuleIds**: readonly `string`[]

Rules that failed that week, in rule order.

***

### openIssueIds

> `readonly` **openIssueIds**: readonly `string`[]

Issues whose defect was in the data that week, in id order.

***

### overall

> `readonly` **overall**: [`DqScore`](DqScore.md)

***

### weekEnding

> `readonly` **weekEnding**: `string`

ISO 8601 date the week ends.
