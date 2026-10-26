[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioBenchmark

# Interface: PortfolioBenchmark

A cycle time compared across the portfolio's studies (#2911).

## Properties

### beyondFences

> `readonly` **beyondFences**: readonly `string`[]

Studies beyond Tukey's fences, in study id order; empty with fewer than
three values. The fences sit at different distances from a skewed
median, so a study can lie beyond one while nearer the median than the
study furthest from it.

***

### lowerQuartile

> `readonly` **lowerQuartile**: `number` \| `null`

***

### lowerQuartileText

> `readonly` **lowerQuartileText**: `string`

***

### median

> `readonly` **median**: `number` \| `null`

Median, lower and upper quartile of the studies' values, or `null` with no values.

***

### medianText

> `readonly` **medianText**: `string`

The median and quartiles with the metric's format at one decimal.

***

### outlier

> `readonly` **outlier**: [`PortfolioOutlier`](PortfolioOutlier.md) \| `null`

The study furthest from the median, or `null` with fewer than three values.

***

### report

> `readonly` **report**: [`ReportData`](../../platform/interfaces/ReportData.md)

The metric by study, from the registry.

***

### studies

> `readonly` **studies**: `number`

Studies with a value; the others have not reached both milestones.

***

### upperQuartile

> `readonly` **upperQuartile**: `number` \| `null`

***

### upperQuartileText

> `readonly` **upperQuartileText**: `string`
