[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / AnalysisSpec

# Type Alias: AnalysisSpec

> **AnalysisSpec** = `Omit`\<[`ArsAnalysis`](../../../../types/interfaces/ArsAnalysis.md), `"results"` \| `"rawDecimals"`\> & `object`

An analysis before it is run: everything but its results.

## Type Declaration

### precisionVariable?

> `readonly` `optional` **precisionVariable?**: `string`

Variable whose recorded decimals set the display precision, when it is
not the analysis variable itself. CHG is a difference of AVAL values,
so it is shown at AVAL's precision rather than with the floating-point
noise of the subtraction.
