[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-handoff](../README.md) / readUsdmHandoff

# Function: readUsdmHandoff()

> **readUsdmHandoff**(`value`, `target`): [`ReadUsdmHandoffResult`](../type-aliases/ReadUsdmHandoffResult.md)

Reads an envelope that arrived at `target`, for example after
`JSON.parse` of stored text. It checks the shape, the version, both tool
names, that this tool is the intended target, and that the document
still matches its hash. The study summary is recomputed from the
document rather than trusted.

## Parameters

### value

`unknown`

### target

[`ClinicalTool`](../type-aliases/ClinicalTool.md)

## Returns

[`ReadUsdmHandoffResult`](../type-aliases/ReadUsdmHandoffResult.md)
