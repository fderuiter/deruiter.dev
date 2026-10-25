[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/plan](../README.md) / effectiveFilters

# Function: effectiveFilters()

> **effectiveFilters**(`metric`, `filters`): [`MetricFilter`](../../../../types/platform/interfaces/MetricFilter.md)[]

The filters in force for a query: the query's own, then each default
filter on a dimension the query does not filter.

## Parameters

### metric

[`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)

### filters

readonly [`MetricFilter`](../../../../types/platform/interfaces/MetricFilter.md)[]

## Returns

[`MetricFilter`](../../../../types/platform/interfaces/MetricFilter.md)[]
