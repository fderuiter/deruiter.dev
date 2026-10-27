[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / WinStatisticEstimate

# Interface: WinStatisticEstimate

A win statistic with its limits and test, `null` where not estimable.

## Properties

### estimate

> `readonly` **estimate**: `number` \| `null`

The point estimate.

***

### lower

> `readonly` **lower**: `number` \| `null`

Lower confidence limit.

***

### pValue

> `readonly` **pValue**: `number` \| `null`

The p-value of the z statistic, with the requested sidedness.

***

### standardError

> `readonly` **standardError**: `number` \| `null`

Standard error, of the logarithm for the win ratio and win odds.

***

### upper

> `readonly` **upper**: `number` \| `null`

Upper confidence limit.

***

### zStatistic

> `readonly` **zStatistic**: `number` \| `null`

The z statistic against no difference.
