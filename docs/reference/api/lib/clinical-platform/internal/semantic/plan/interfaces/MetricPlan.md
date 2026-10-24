[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/plan](../README.md) / MetricPlan

# Interface: MetricPlan

A checked request for one metric.

## Properties

### dataCut

> `readonly` **dataCut**: `string` \| `null`

ISO 8601 data cut, or `null` when the metric does not use it.

***

### dimensions

> `readonly` **dimensions**: readonly [`MetricDimensionId`](../../../../types/type-aliases/MetricDimensionId.md)[]

***

### filters

> `readonly` **filters**: readonly [`MetricFilter`](../../../../types/interfaces/MetricFilter.md)[]

***

### metric

> `readonly` **metric**: [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)

***

### sources

> `readonly` **sources**: readonly [`SourcePlan`](SourcePlan.md)[]
