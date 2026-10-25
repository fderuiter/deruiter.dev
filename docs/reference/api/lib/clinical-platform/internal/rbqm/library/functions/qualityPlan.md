[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/rbqm/library](../README.md) / qualityPlan

# Function: qualityPlan()

> **qualityPlan**(`studyId`, `productType`, `startOn`): [`QualityPlan`](../../../../types/interfaces/QualityPlan.md)

The quality plan of a study: its critical-to-quality factors and QTL
limits, in force from the study's start.

## Parameters

### studyId

`string`

Study id.

### productType

`string`

`gold.dim_study.product_type`; `device` takes the device limits, and `drug` and `biologic` the drug limits.

### startOn

`string`

ISO 8601 study start date, from `gold.dim_study`.

## Returns

[`QualityPlan`](../../../../types/interfaces/QualityPlan.md)

The study's synthetic quality plan, version 1.0.
