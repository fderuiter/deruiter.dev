[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-selection](../README.md) / resolveUsdmStudyDesign

# Function: resolveUsdmStudyDesign()

> **resolveUsdmStudyDesign**(`study`, `selection?`): [`UsdmSelectionResult`](../type-aliases/UsdmSelectionResult.md)

Resolves the study version and design to read from a USDM v4 `study`.
Without a selection it succeeds only when there is exactly one version
with exactly one design; otherwise it returns `ambiguous` with the options,
so the caller can ask rather than read the first.

## Parameters

### study

`unknown`

### selection?

[`UsdmStudySelection`](../interfaces/UsdmStudySelection.md)

## Returns

[`UsdmSelectionResult`](../type-aliases/UsdmSelectionResult.md)
