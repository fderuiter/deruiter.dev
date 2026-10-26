[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioOutlier

# Interface: PortfolioOutlier

A study furthest from the portfolio median of a cycle time (#2911).

## Properties

### beyondFence

> `readonly` **beyondFence**: `boolean`

Whether the value lies beyond Tukey's fences, more than 1.5 times the
interquartile range below the lower quartile or above the upper one.

***

### fromMedian

> `readonly` **fromMedian**: `number`

Value minus the median; positive is slower than the median.

***

### fromMedianText

> `readonly` **fromMedianText**: `string`

How far from the median, as a positive number with one decimal.

***

### studyId

> `readonly` **studyId**: `string`

***

### text

> `readonly` **text**: `string`

The value with the metric's format.

***

### value

> `readonly` **value**: `number`
