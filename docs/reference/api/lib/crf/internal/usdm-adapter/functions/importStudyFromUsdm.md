[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/usdm-adapter](../README.md) / importStudyFromUsdm

# Function: importStudyFromUsdm()

> **importStudyFromUsdm**(`usdmInput`, `options?`): [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

Imports a CDISC USDM JSON document or object into an internal CRF Studio StudyProtocol.
A USDM v4 document with more than one study version or design needs `options.selection`;
without it the import throws and names the choices rather than reading the first.
Reassembles linear encounter schedules into visit sequences, extracts valueSets and codeList references into study codelists,
maps windowBefore and windowAfter visit tolerances to constrain study schedule rules, and resolves decoupled BiomedicalConcept definitions.

## Parameters

### usdmInput

`string` \| `Record`\<`string`, `unknown`\> \| [`UsdmV4Document`](../../../../clinical-standards/usdm-v4-types/interfaces/UsdmV4Document.md) \| [`UsdmDocument`](../interfaces/UsdmDocument.md)

### options?

#### selection?

[`UsdmStudySelection`](../../../../clinical-standards/usdm-v4-selection/interfaces/UsdmStudySelection.md)

## Returns

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)
