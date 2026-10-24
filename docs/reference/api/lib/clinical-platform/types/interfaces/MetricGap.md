[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricGap

# Interface: MetricGap

A metric a clinical operations or portfolio lead would expect that the gold
model cannot compute yet, and what it lacks. Listed rather than faked.

## Properties

### missing

> `readonly` **missing**: `string`

Gold data that would make it computable.

***

### name

> `readonly` **name**: `string`

Metric name.

***

### nearestMetricId

> `readonly` **nearestMetricId**: `string` \| `null`

Registry metric that covers part of the need, or `null`.

***

### reason

> `readonly` **reason**: `string`

Why the registry leaves it out.
