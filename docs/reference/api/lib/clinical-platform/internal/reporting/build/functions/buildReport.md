[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/build](../README.md) / buildReport

# Function: buildReport()

> **buildReport**(`warehouse`, `spec`, `metrics?`): [`ReportData`](../../../../types/interfaces/ReportData.md)

Evaluates every metric of a report over one warehouse and joins the
results into rows: one per group any metric has a row for, with a cell
per metric. A metric with no row for a group gets a `null` cell that
reads `NO_METRIC_ROWS`, which is not the same as a zero: the group may be
outside the metric's filters.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

The warehouse to report on.

### spec

[`ReportSpec`](../../../../types/interfaces/ReportSpec.md)

The report spec.

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`ReportData`](../../../../types/interfaces/ReportData.md)

The report's columns, rows and calculations.

## Throws

Error when the spec breaks a reporting rule (see
  `checkReportSpec`), naming every finding.
