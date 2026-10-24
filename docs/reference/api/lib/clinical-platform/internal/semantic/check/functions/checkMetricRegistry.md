[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/semantic/check](../README.md) / checkMetricRegistry

# Function: checkMetricRegistry()

> **checkMetricRegistry**(`metrics?`): [`MetricFinding`](../../../../types/interfaces/MetricFinding.md)[]

Checks metric definitions against the gold model and the registry's rules.
A definition must read gold tables and columns that exist, with types its
aggregation accepts; guard every nullable column it reads with a not-null
condition (a `null` operand differs between SQL and DAX); reach every
allowed dimension from every table it reads; keep a semantic version that
its change log ends at; link an existing glossary term; and make no
compliance or validation claim. Ids and names must be unique.

## Parameters

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

Definitions to check; defaults to `METRIC_REGISTRY`.

## Returns

[`MetricFinding`](../../../../types/interfaces/MetricFinding.md)[]

Every broken rule; empty when the registry is sound.
