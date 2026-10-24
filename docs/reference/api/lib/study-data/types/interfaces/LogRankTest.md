[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / LogRankTest

# Interface: LogRankTest

An unstratified log-rank test across groups.

## Properties

### chiSquare

> `readonly` **chiSquare**: `number` \| `null`

The chi-square statistic, or `null` when not estimable.

***

### covariance

> `readonly` **covariance**: readonly (readonly `number`[])[]

Covariance of observed minus expected, one row per group.

***

### degreesOfFreedom

> `readonly` **degreesOfFreedom**: `number`

Rank of the covariance: groups with information less one.

***

### expected

> `readonly` **expected**: readonly `number`[]

Expected events per group under equal survival.

***

### observed

> `readonly` **observed**: readonly `number`[]

Observed events per group.

***

### pValue

> `readonly` **pValue**: `number` \| `null`

Upper-tail chi-square probability, or `null` when not estimable.
