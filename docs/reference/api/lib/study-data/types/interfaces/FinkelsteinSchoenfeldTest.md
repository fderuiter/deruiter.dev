[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / FinkelsteinSchoenfeldTest

# Interface: FinkelsteinSchoenfeldTest

The Finkelstein-Schoenfeld rank test on the pooled pairwise scores.

## Properties

### pValue

> `readonly` **pValue**: `number` \| `null`

Its p-value, with the requested sidedness, or `null`.

***

### statistic

> `readonly` **statistic**: `number`

Sum over treatment subjects of their pooled scores, over strata.

***

### variance

> `readonly` **variance**: `number`

Permutation variance of the statistic, over strata.

***

### zStatistic

> `readonly` **zStatistic**: `number` \| `null`

The standardised statistic, or `null` when the variance is 0.
