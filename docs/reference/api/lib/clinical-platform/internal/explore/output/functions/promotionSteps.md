[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/explore/output](../README.md) / promotionSteps

# Function: promotionSteps()

> **promotionSteps**(`spec`, `metrics?`): [`PromotionStep`](../../../../types/interfaces/PromotionStep.md)[]

The steps that promote an exploratory report to a managed report, owned
and maintained by a team, and then to a certified one. A step is `met`
when the spec already satisfies it, and `to-do` when a person has to act.
The explorer shows the list; it never promotes anything itself.

## Parameters

### spec

[`ReportSpec`](../../../../types/interfaces/ReportSpec.md)

An exploratory report spec, usually from `runExploration`.

### metrics?

readonly [`MetricDefinition`](../../../../types/interfaces/MetricDefinition.md)[] = `METRIC_REGISTRY`

The registry; defaults to `METRIC_REGISTRY`.

## Returns

[`PromotionStep`](../../../../types/interfaces/PromotionStep.md)[]

The steps, managed first, then certified.
