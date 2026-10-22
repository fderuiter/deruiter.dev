[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-adapter](../README.md) / importStudyFromUsdm

# Function: importStudyFromUsdm()

> **importStudyFromUsdm**(`usdmInput`): [`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

Imports a CDISC USDM JSON document or object into an internal CRF Studio StudyProtocol.
Reassembles linear encounter schedules into visit sequences, extracts valueSets and codeList references into study codelists,
maps windowBefore and windowAfter visit tolerances to constrain study schedule rules, and resolves decoupled BiomedicalConcept definitions.

## Parameters

### usdmInput

`string` \| `Record`\<`string`, `unknown`\> \| [`UsdmV4Document`](../../usdm-v4-types/interfaces/UsdmV4Document.md) \| [`UsdmDocument`](../interfaces/UsdmDocument.md)

## Returns

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)
