[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/sql](../README.md) / metricFlowRowSql

# Function: metricFlowRowSql()

> **metricFlowRowSql**(`measure`, `dataCut`): `object`

A measure's value and row condition as DuckDB SQL over its own table's
unqualified columns, for dbt MetricFlow measure expressions.

## Parameters

### measure

[`MetricMeasure`](../../../../types/interfaces/MetricMeasure.md)

The measure.

### dataCut

`string` \| `null`

ISO 8601 data cut, for measures that use it.

## Returns

`object`

The value expression (`null` for a count) and the AND of the
row predicates (`null` when there are none).

### condition

> `readonly` **condition**: `string` \| `null`

### value

> `readonly` **value**: `string` \| `null`
