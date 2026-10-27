[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-selection](../README.md) / UsdmSelectionResult

# Type Alias: UsdmSelectionResult

> **UsdmSelectionResult** = \{ `design`: [`UsdmV4InterventionalStudyDesign`](../../usdm-v4-types/interfaces/UsdmV4InterventionalStudyDesign.md); `designIndex`: `number`; `ok`: `true`; `version`: [`UsdmV4StudyVersion`](../../usdm-v4-types/interfaces/UsdmV4StudyVersion.md); `versionIndex`: `number`; \} \| \{ `code`: [`UsdmSelectionProblemCode`](UsdmSelectionProblemCode.md); `message`: `string`; `ok`: `false`; `options`: [`UsdmStudyVersionOption`](../interfaces/UsdmStudyVersionOption.md)[]; \}

The outcome of [resolveUsdmStudyDesign](../functions/resolveUsdmStudyDesign.md).
