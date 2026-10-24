[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricFinding

# Interface: MetricFinding

A broken metric governance rule.

## Properties

### message

> `readonly` **message**: `string`

What is wrong, in one sentence.

***

### metricId

> `readonly` **metricId**: `string` \| `null`

Metric the finding is about, or `null` for a registry-wide finding.

***

### rule

> `readonly` **rule**: `"definition"` \| `"version"` \| `"report"`

Rule family: the definition itself, its versioning, or a report's use of it.
