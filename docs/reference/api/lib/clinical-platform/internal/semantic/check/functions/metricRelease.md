[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/check](../README.md) / metricRelease

# Function: metricRelease()

> **metricRelease**(`metric`): [`MetricRelease`](../../../../types/interfaces/MetricRelease.md)

The release record of a metric: its id, version, status and contract, the
part of the definition that decides its values.

## Parameters

### metric

[`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)

Metric definition.

## Returns

[`MetricRelease`](../../../../types/interfaces/MetricRelease.md)

The release, as the registry lock file records it.
