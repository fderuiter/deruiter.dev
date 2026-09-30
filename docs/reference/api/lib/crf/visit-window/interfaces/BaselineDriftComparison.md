[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / BaselineDriftComparison

# Interface: BaselineDriftComparison

## Properties

### baselineLabel?

> `optional` **baselineLabel?**: `string`

Label/version tag of baseline snapshot used

***

### hasBaseline

> **hasBaseline**: `boolean`

Whether a baseline snapshot was found and compared against

***

### maxContractionDriftDays

> **maxContractionDriftDays**: `number`

Maximum contraction drift: difference between current min duration and baseline min duration

***

### maxExpansionDriftDays

> **maxExpansionDriftDays**: `number`

Maximum expansion drift: difference between current max duration and baseline max duration

***

### targetDurationDriftDays

> **targetDurationDriftDays**: `number`

Target day drift: difference between current target duration and baseline target duration

***

### visitDrifts

> **visitDrifts**: `object`[]

Per-visit target day drift details

#### baselineTargetDay?

> `optional` **baselineTargetDay?**: `number`

#### currentTargetDay

> **currentTargetDay**: `number`

#### targetDayDelta

> **targetDayDelta**: `number`

#### visitId

> **visitId**: `string`

#### visitName

> **visitName**: `string`

#### windowAfterDelta

> **windowAfterDelta**: `number`

#### windowBeforeDelta

> **windowBeforeDelta**: `number`
