[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricQuery

# Interface: MetricQuery

A request for a metric's value, grouped and filtered.

## Properties

### dimensions?

> `readonly` `optional` **dimensions?**: readonly [`MetricDimensionId`](../type-aliases/MetricDimensionId.md)[]

Dimensions to group by, in output order; empty or absent for one total.

***

### filters?

> `readonly` `optional` **filters?**: readonly [`MetricFilter`](MetricFilter.md)[]

Filters; each replaces the metric's default filter on the same dimension.
