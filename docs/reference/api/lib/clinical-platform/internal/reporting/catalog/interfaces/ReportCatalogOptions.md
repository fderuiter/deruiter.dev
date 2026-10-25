[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/catalog](../README.md) / ReportCatalogOptions

# Interface: ReportCatalogOptions

What the catalog knows beyond the specs themselves.

## Properties

### lastRefresh?

> `readonly` `optional` **lastRefresh?**: `string`

ISO 8601 data cut the reports were last refreshed to, if known.

***

### metrics?

> `readonly` `optional` **metrics?**: readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[]

The registry; defaults to `METRIC_REGISTRY`.

***

### usage?

> `readonly` `optional` **usage?**: `Readonly`\<`Record`\<`string`, \{ `views`: `number`; \}\>\>

View counters keyed by telemetry project slug, as the telemetry API returns them.
