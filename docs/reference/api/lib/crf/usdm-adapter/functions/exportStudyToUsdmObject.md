[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-adapter](../README.md) / exportStudyToUsdmObject

# Function: exportStudyToUsdmObject()

> **exportStudyToUsdmObject**(`study`): [`UsdmV4Document`](../../usdm-v4-types/interfaces/UsdmV4Document.md)

Transforms a CRF Studio StudyProtocol into a CDISC USDM v4.0 document.
Decouples field-level presentation properties into independent BiomedicalConcept nodes,
places arms, epochs, study cells, encounters and activities on an interventional study design,
and expresses visit target days and windows as schedule timeline timings.
CRF Studio data with no USDM home (form layouts, edit checks, codelists) travels in
USDM extension attributes, so the export stays valid against the USDM v4 schema and re-imports losslessly.

## Parameters

### study

[`StudyProtocol`](../../types/interfaces/StudyProtocol.md)

## Returns

[`UsdmV4Document`](../../usdm-v4-types/interfaces/UsdmV4Document.md)
