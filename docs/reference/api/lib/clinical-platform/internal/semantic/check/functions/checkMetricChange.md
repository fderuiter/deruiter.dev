[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/check](../README.md) / checkMetricChange

# Function: checkMetricChange()

> **checkMetricChange**(`previous`, `next`): [`MetricFinding`](../../../../types/semantic/interfaces/MetricFinding.md)[]

Checks one release of a metric against the release before it. A change to
the formula, grain, unit or default filters, or a removed dimension, is
breaking: a certified metric then needs a major version bump. An added
dimension or a status change needs at least a minor bump. A version may
not go backwards, the same version may not describe two contracts, and a
deprecated metric does not return to use.

## Parameters

### previous

[`MetricRelease`](../../../../types/semantic/interfaces/MetricRelease.md)

The earlier release.

### next

[`MetricRelease`](../../../../types/semantic/interfaces/MetricRelease.md)

The release that follows it.

## Returns

[`MetricFinding`](../../../../types/semantic/interfaces/MetricFinding.md)[]

Every broken versioning rule; empty when the change is versioned correctly.
