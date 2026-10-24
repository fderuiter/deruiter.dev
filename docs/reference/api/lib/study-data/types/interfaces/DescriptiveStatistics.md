[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / DescriptiveStatistics

# Interface: DescriptiveStatistics

Summary statistics of one set of values, from `descriptiveStatistics`.

## Properties

### max

> `readonly` **max**: `number` \| `null`

Largest value.

***

### mean

> `readonly` **mean**: `number` \| `null`

Arithmetic mean, `null` when there are no values.

***

### median

> `readonly` **median**: `number` \| `null`

Median; the mean of the two middle values for an even count.

***

### min

> `readonly` **min**: `number` \| `null`

Smallest value.

***

### n

> `readonly` **n**: `number`

Number of values.

***

### rawDecimals

> `readonly` **rawDecimals**: `number`

Decimals the values were recorded with.

***

### sd

> `readonly` **sd**: `number` \| `null`

Sample SD with the n - 1 denominator, `null` for fewer than two values.
