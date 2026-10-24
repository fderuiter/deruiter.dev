[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/dimensions](../README.md) / resolveDimension

# Function: resolveDimension()

> **resolveDimension**(`table`, `timeKey`, `id`): [`DimensionPath`](../interfaces/DimensionPath.md) \| `null`

Resolves a dimension for a measure's table. A dimension is reachable when
the table is the dimension's own table, when it has a foreign key to that
table, or when it carries the dimension table's single-column natural key
(as `dim_site` carries `study_id`). `month` is reached through the
measure's time key only.

## Parameters

### table

`string`

Qualified table the measure reads.

### timeKey

`string` \| `null`

The measure's date key column, or `null`.

### id

[`MetricDimensionId`](../../../../types/type-aliases/MetricDimensionId.md)

Dimension to reach.

## Returns

[`DimensionPath`](../interfaces/DimensionPath.md) \| `null`

The path, or `null` when the table cannot reach the dimension.
