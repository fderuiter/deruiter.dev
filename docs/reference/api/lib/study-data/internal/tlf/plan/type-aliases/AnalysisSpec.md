[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / AnalysisSpec

# Type Alias: AnalysisSpec

> **AnalysisSpec** = `Omit`\<[`ArsAnalysis`](../../../../types/interfaces/ArsAnalysis.md), `"results"` \| `"rawDecimals"`\> & `object`

An analysis before it is run: everything but its results.

## Type Declaration

### comparison?

> `readonly` `optional` **comparison?**: `object`

For a two-group comparison, which group of the treatment grouping is
the treatment and which the control. ARS 1.0 has no place for the
direction of a comparison, so it is left out of the reporting event and
written into the analysis name instead.

#### comparison.controlGroupId

> `readonly` **controlGroupId**: `string`

#### comparison.groupingId

> `readonly` **groupingId**: `string`

#### comparison.treatmentGroupId

> `readonly` **treatmentGroupId**: `string`

### precisionVariable?

> `readonly` `optional` **precisionVariable?**: `string`

Variable whose recorded decimals set the display precision, when it is
not the analysis variable itself. CHG is a difference of AVAL values,
so it is shown at AVAL's precision rather than with the floating-point
noise of the subtraction.
