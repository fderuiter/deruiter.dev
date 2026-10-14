[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director/types](../README.md) / StudySetup

# Interface: StudySetup

## Properties

### budget

> **budget**: `number`

***

### clinicalPhase

> **clinicalPhase**: `string`

***

### complexity

> **complexity**: `number`

Operational complexity, 1 to 5.

***

### design

> **design**: `string`

***

### durationDays

> **durationDays**: `number`

***

### id

> **id**: `string`

***

### length?

> `optional` **length?**: `"full"` \| `"short"`

The short study (#2092) squeezes the scripted calendar into its own
duration. Omitted means the full study, as every save made before it.

***

### protocolMaturity

> **protocolMaturity**: `"solid"` \| `"questionable"` \| `"shaky"`

***

### regulatoryRisk

> **regulatoryRisk**: `"high"` \| `"moderate"` \| `"low"`

***

### sponsor

> **sponsor**: `object`

#### archetype

> **archetype**: [`SponsorArchetype`](../type-aliases/SponsorArchetype.md)

#### name

> **name**: `string`

***

### subjects

> **subjects**: `number`

***

### title

> **title**: `string`
