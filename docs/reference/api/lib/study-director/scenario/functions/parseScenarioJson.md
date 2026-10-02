[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/scenario](../README.md) / parseScenarioJson

# Function: parseScenarioJson()

> **parseScenarioJson**(`jsonString`): \{ `data`: \{ `description?`: `string`; `id`: `string`; `name`: `string`; `setup`: \{ `budget`: `number`; `clinicalPhase`: `string`; `complexity`: `number`; `design`: `string`; `durationDays`: `number`; `id`: `string`; `protocolMaturity`: `"solid"` \| `"questionable"` \| `"shaky"`; `regulatoryRisk`: `"moderate"` \| `"high"` \| `"low"`; `sponsor`: \{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \}; `subjects`: `number`; `title`: `string`; \}; `sites`: `object`[]; `team`: `object`[]; `version`: `1`; \}; `success`: `true`; \} \| \{ `error`: `string`; `success`: `false`; \}

Parses and validates a JSON string into a StudyScenario.

## Parameters

### jsonString

`string`

## Returns

\{ `data`: \{ `description?`: `string`; `id`: `string`; `name`: `string`; `setup`: \{ `budget`: `number`; `clinicalPhase`: `string`; `complexity`: `number`; `design`: `string`; `durationDays`: `number`; `id`: `string`; `protocolMaturity`: `"solid"` \| `"questionable"` \| `"shaky"`; `regulatoryRisk`: `"moderate"` \| `"high"` \| `"low"`; `sponsor`: \{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \}; `subjects`: `number`; `title`: `string`; \}; `sites`: `object`[]; `team`: `object`[]; `version`: `1`; \}; `success`: `true`; \} \| \{ `error`: `string`; `success`: `false`; \}
