[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/scenario](../README.md) / createScenarioFromPreset

# Function: createScenarioFromPreset()

> **createScenarioFromPreset**(`overrides?`): `object`

Creates a StudyScenario using default STUDY_24_081 preset values with optional overrides.

## Parameters

### overrides?

`Partial`\<\{ `description?`: `string`; `id`: `string`; `name`: `string`; `setup`: \{ `budget`: `number`; `clinicalPhase`: `string`; `complexity`: `number`; `design`: `string`; `durationDays`: `number`; `id`: `string`; `protocolMaturity`: `"solid"` \| `"questionable"` \| `"shaky"`; `regulatoryRisk`: `"moderate"` \| `"high"` \| `"low"`; `sponsor`: \{ `archetype`: `"firstTimeBiotech"` \| `"bigPharma"`; `name`: `string`; \}; `subjects`: `number`; `title`: `string`; \}; `sites`: `object`[]; `team`: `object`[]; `version`: `1`; \}\>

## Returns

`object`

### description?

> `optional` **description?**: `string`

### id

> **id**: `string`

### name

> **name**: `string`

### setup

> **setup**: `object` = `StudySetupSchema`

#### setup.budget

> **budget**: `number`

#### setup.clinicalPhase

> **clinicalPhase**: `string`

#### setup.complexity

> **complexity**: `number`

#### setup.design

> **design**: `string`

#### setup.durationDays

> **durationDays**: `number`

#### setup.id

> **id**: `string`

#### setup.protocolMaturity

> **protocolMaturity**: `"solid"` \| `"questionable"` \| `"shaky"` = `ProtocolMaturitySchema`

#### setup.regulatoryRisk

> **regulatoryRisk**: `"moderate"` \| `"high"` \| `"low"` = `RegulatoryRiskSchema`

#### setup.sponsor

> **sponsor**: `object`

#### setup.sponsor.archetype

> **archetype**: `"firstTimeBiotech"` \| `"bigPharma"` = `SponsorArchetypeSchema`

#### setup.sponsor.name

> **name**: `string`

#### setup.subjects

> **subjects**: `number`

#### setup.title

> **title**: `string`

### sites

> **sites**: `object`[]

### team

> **team**: `object`[]

### version

> **version**: `1`
