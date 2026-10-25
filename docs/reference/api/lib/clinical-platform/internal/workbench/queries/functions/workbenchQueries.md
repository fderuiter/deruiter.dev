[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/workbench/queries](../README.md) / workbenchQueries

# Function: workbenchQueries()

> **workbenchQueries**(`dataCut`, `metrics?`): [`WorkbenchQuery`](../../../../types/workbench/interfaces/WorkbenchQuery.md)[]

The saved queries: the worked examples, then one per governed metric in
registry order, each metric query carrying its DuckDB, PostgreSQL and
T-SQL forms.

## Parameters

### dataCut

`string`

ISO 8601 date of the data cut, written into the queries
  that measure age at the cut. Usually the warehouse's `asOf`.

### metrics?

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

Metrics to include, usually `METRIC_REGISTRY`.

## Returns

[`WorkbenchQuery`](../../../../types/workbench/interfaces/WorkbenchQuery.md)[]

The queries, with unique ids.

## Throws

RangeError when `dataCut` is not a date.
