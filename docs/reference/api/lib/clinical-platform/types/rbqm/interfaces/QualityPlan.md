[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/rbqm](../README.md) / QualityPlan

# Interface: QualityPlan

A study's quality plan: its critical-to-quality factors and QTL limits.

## Properties

### effectiveOn

> `readonly` **effectiveOn**: `string`

ISO 8601 date the plan took effect.

***

### factors

> `readonly` **factors**: readonly [`CriticalToQualityFactor`](CriticalToQualityFactor.md)[]

***

### qtls

> `readonly` **qtls**: readonly [`QualityPlanQtl`](QualityPlanQtl.md)[]

***

### studyId

> `readonly` **studyId**: `string`

***

### synthetic

> `readonly` **synthetic**: `true`

Synthetic plan for a fictional study.

***

### version

> `readonly` **version**: `string`
