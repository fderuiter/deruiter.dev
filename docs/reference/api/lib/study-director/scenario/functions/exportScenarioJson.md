[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/scenario](../README.md) / exportScenarioJson

# Function: exportScenarioJson()

> **exportScenarioJson**(`scenario`): `string`

Exports a StudyScenario as formatted scenario JSON text.

## Parameters

### scenario

#### description?

`string` = `...`

#### id

`string` = `...`

#### name

`string` = `...`

#### setup

\{ `budget`: `number`; `clinicalPhase`: `string`; `complexity`: `number`; `design`: `string`; `durationDays`: `number`; `id`: `string`; `protocolMaturity`: `"solid"` \| `"questionable"` \| `"shaky"`; `regulatoryRisk`: `"moderate"` \| `"high"` \| `"low"`; `sponsor`: \{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \}; `subjects`: `number`; `title`: `string`; \} = `StudySetupSchema`

#### setup.budget

`number` = `...`

#### setup.clinicalPhase

`string` = `...`

#### setup.complexity

`number` = `...`

#### setup.design

`string` = `...`

#### setup.durationDays

`number` = `...`

#### setup.id

`string` = `...`

#### setup.protocolMaturity

`"solid"` \| `"questionable"` \| `"shaky"` = `ProtocolMaturitySchema`

#### setup.regulatoryRisk

`"moderate"` \| `"high"` \| `"low"` = `RegulatoryRiskSchema`

#### setup.sponsor

\{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \} = `...`

#### setup.sponsor.archetype

`"firstTimeBiotech"` \| `"bigPharma"` = `SponsorArchetypeSchema`

#### setup.sponsor.name

`string` = `...`

#### setup.subjects

`number` = `...`

#### setup.title

`string` = `...`

#### sites

`object`[] = `...`

#### team

`object`[] = `...`

#### version

`1` = `...`

## Returns

`string`
