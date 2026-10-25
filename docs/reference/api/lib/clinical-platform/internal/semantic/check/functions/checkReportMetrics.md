[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/check](../README.md) / checkReportMetrics

# Function: checkReportMetrics()

> **checkReportMetrics**(`report`, `metrics?`): [`MetricFinding`](../../../../types/semantic/interfaces/MetricFinding.md)[]

Checks the metrics a report uses. Every id must name a registry metric,
and a certified report may only use certified metrics: never a draft and
never a deprecated one.

## Parameters

### report

[`MetricReport`](../../../../types/semantic/interfaces/MetricReport.md)

The report and the metric ids it shows.

### metrics?

readonly [`MetricDefinition`](../../../../types/platform/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`MetricFinding`](../../../../types/semantic/interfaces/MetricFinding.md)[]

One finding per broken rule; empty when the report may publish.
