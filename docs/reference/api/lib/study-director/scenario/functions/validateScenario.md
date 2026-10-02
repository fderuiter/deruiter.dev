[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/scenario](../README.md) / validateScenario

# Function: validateScenario()

> **validateScenario**(`data`): \{ `data`: \{ `description?`: `string`; `id`: `string`; `name`: `string`; `setup`: \{ `budget`: `number`; `clinicalPhase`: `string`; `complexity`: `number`; `design`: `string`; `durationDays`: `number`; `id`: `string`; `protocolMaturity`: `"solid"` \| `"questionable"` \| `"shaky"`; `regulatoryRisk`: `"moderate"` \| `"high"` \| `"low"`; `sponsor`: \{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \}; `subjects`: `number`; `title`: `string`; \}; `sites`: `object`[]; `team`: `object`[]; `version`: `1`; \}; `success`: `true`; \} \| \{ `error`: `string`; `success`: `false`; \}

Validates arbitrary input data against the StudyScenario schema.

## Parameters

### data

`unknown`

## Returns

\{ `data`: \{ `description?`: `string`; `id`: `string`; `name`: `string`; `setup`: \{ `budget`: `number`; `clinicalPhase`: `string`; `complexity`: `number`; `design`: `string`; `durationDays`: `number`; `id`: `string`; `protocolMaturity`: `"solid"` \| `"questionable"` \| `"shaky"`; `regulatoryRisk`: `"moderate"` \| `"high"` \| `"low"`; `sponsor`: \{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \}; `subjects`: `number`; `title`: `string`; \}; `sites`: `object`[]; `team`: `object`[]; `version`: `1`; \}; `success`: `true`; \} \| \{ `error`: `string`; `success`: `false`; \}
