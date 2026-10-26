[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioSwimlane

# Interface: PortfolioSwimlane

The milestone swimlane: one lane per study on one time axis (#2911).

## Properties

### from

> `readonly` **from**: `string`

ISO 8601 first day of the axis: the earliest planned or actual milestone, at the start of its month.

***

### kinds

> `readonly` **kinds**: readonly `object`[]

The milestone kinds in lifecycle order, with their conformed names from `gold.dim_milestone`.

***

### lanes

> `readonly` **lanes**: readonly [`PortfolioLane`](PortfolioLane.md)[]

One lane per study, in study id order.

***

### to

> `readonly` **to**: `string`

ISO 8601 last day of the axis: the first day of the month after the latest milestone.

***

### years

> `readonly` **years**: readonly `string`[]

First day of each year on the axis, for gridlines.
