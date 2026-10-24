[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/check](../README.md) / checkReportSpec

# Function: checkReportSpec()

> **checkReportSpec**(`spec`, `metrics?`): [`ReportFinding`](../../../../types/interfaces/ReportFinding.md)[]

Checks a report spec against the reporting rules:

- its id, text fields, version and refresh SLA are well formed, and it
  lists each metric and dimension once;
- every metric is in the registry and may be grouped and filtered the way
  the spec asks; a certified report uses only certified metrics, and no
  report uses a deprecated one;
- its visual fits its grouping, and a chart's metrics share one unit;
- a certified report carries an owner's sign-off on its current version.

## Parameters

### spec

[`ReportSpec`](../../../../types/interfaces/ReportSpec.md)

The spec.

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ReportFinding`](../../../../types/interfaces/ReportFinding.md)[]

One finding per broken rule; empty when the report may be built.
