[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-types](../README.md) / UsdmV4InterventionalStudyDesign

# Interface: UsdmV4InterventionalStudyDesign

An interventional study design.

## Extends

- [`UsdmV4Named`](UsdmV4Named.md)

## Properties

### activities?

> `optional` **activities?**: [`UsdmV4Activity`](UsdmV4Activity.md)[]

***

### analysisPopulations?

> `optional` **analysisPopulations?**: [`UsdmV4AnalysisPopulation`](UsdmV4AnalysisPopulation.md)[]

***

### arms

> **arms**: [`UsdmV4StudyArm`](UsdmV4StudyArm.md)[]

***

### blindingSchema?

> `optional` **blindingSchema?**: [`UsdmV4AliasCode`](UsdmV4AliasCode.md) \| `null`

***

### characteristics?

> `optional` **characteristics?**: [`UsdmV4Code`](UsdmV4Code.md)[]

***

### description?

> `optional` **description?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`description`](UsdmV4Named.md#description)

***

### elements?

> `optional` **elements?**: [`UsdmV4StudyElement`](UsdmV4StudyElement.md)[]

***

### eligibilityCriteria

> **eligibilityCriteria**: [`UsdmV4EligibilityCriterion`](UsdmV4EligibilityCriterion.md)[]

***

### encounters?

> `optional` **encounters?**: [`UsdmV4Encounter`](UsdmV4Encounter.md)[]

***

### epochs

> **epochs**: [`UsdmV4StudyEpoch`](UsdmV4StudyEpoch.md)[]

***

### estimands?

> `optional` **estimands?**: [`UsdmV4Estimand`](UsdmV4Estimand.md)[]

***

### extensionAttributes?

> `optional` **extensionAttributes?**: [`UsdmV4ExtensionAttribute`](UsdmV4ExtensionAttribute.md)[]

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`extensionAttributes`](UsdmV4Named.md#extensionattributes)

***

### id

> **id**: `string`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`id`](UsdmV4Named.md#id)

***

### instanceType

> **instanceType**: `"InterventionalStudyDesign"`

***

### intentTypes?

> `optional` **intentTypes?**: [`UsdmV4Code`](UsdmV4Code.md)[]

***

### label?

> `optional` **label?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`label`](UsdmV4Named.md#label)

***

### model

> **model**: [`UsdmV4Code`](UsdmV4Code.md)

***

### name

> **name**: `string`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`name`](UsdmV4Named.md#name)

***

### objectives?

> `optional` **objectives?**: [`UsdmV4Objective`](UsdmV4Objective.md)[]

***

### population

> **population**: [`UsdmV4StudyDesignPopulation`](UsdmV4StudyDesignPopulation.md)

***

### rationale

> **rationale**: `string`

***

### scheduleTimelines?

> `optional` **scheduleTimelines?**: [`UsdmV4ScheduleTimeline`](UsdmV4ScheduleTimeline.md)[]

***

### studyCells

> **studyCells**: [`UsdmV4StudyCell`](UsdmV4StudyCell.md)[]

***

### studyInterventionIds?

> `optional` **studyInterventionIds?**: `string`[]

***

### studyPhase?

> `optional` **studyPhase?**: [`UsdmV4AliasCode`](UsdmV4AliasCode.md) \| `null`

***

### studyType?

> `optional` **studyType?**: [`UsdmV4Code`](UsdmV4Code.md) \| `null`

***

### subTypes?

> `optional` **subTypes?**: [`UsdmV4Code`](UsdmV4Code.md)[]

***

### therapeuticAreas?

> `optional` **therapeuticAreas?**: [`UsdmV4Code`](UsdmV4Code.md)[]
