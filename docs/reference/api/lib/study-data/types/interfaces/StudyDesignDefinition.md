[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / StudyDesignDefinition

# Interface: StudyDesignDefinition

The study design the pipeline reads from the USDM document.

## Properties

### activities

> `readonly` **activities**: readonly [`ActivityDefinition`](ActivityDefinition.md)[]

Activities, in protocol order.

***

### analysisPopulations

> `readonly` **analysisPopulations**: readonly [`AnalysisPopulationDefinition`](AnalysisPopulationDefinition.md)[]

Analysis populations.

***

### arms

> `readonly` **arms**: readonly [`ArmDefinition`](ArmDefinition.md)[]

Arms, in protocol order.

***

### blinding

> `readonly` **blinding**: `string`

Blinding decode, for example `Double Blind Study`.

***

### blindingCode

> `readonly` **blindingCode**: `string`

Blinding NCI EVS code.

***

### cells

> `readonly` **cells**: readonly [`StudyCellDefinition`](StudyCellDefinition.md)[]

Arm by epoch study cells.

***

### elements

> `readonly` **elements**: readonly [`ElementDefinition`](ElementDefinition.md)[]

Trial design elements.

***

### eligibilityCriteria

> `readonly` **eligibilityCriteria**: readonly [`EligibilityCriterionDefinition`](EligibilityCriterionDefinition.md)[]

Inclusion and exclusion criteria, in protocol order.

***

### epochs

> `readonly` **epochs**: readonly [`EpochDefinition`](EpochDefinition.md)[]

Epochs, in sequence.

***

### estimands

> `readonly` **estimands**: readonly [`EstimandDefinition`](EstimandDefinition.md)[]

Estimands.

***

### interventionType

> `readonly` **interventionType**: [`CodedValue`](CodedValue.md)

Type of the experimental intervention, coded in Intervention Type
Response (C99078), for example `C1909`. Empty when the study names none.

***

### model

> `readonly` **model**: `string`

Intervention model decode, for example `Parallel Study`.

***

### modelCode

> `readonly` **modelCode**: `string`

Intervention model NCI EVS code.

***

### objectives

> `readonly` **objectives**: readonly [`ObjectiveDefinition`](ObjectiveDefinition.md)[]

Objectives and their endpoints.

***

### pharmacologicClass

> `readonly` **pharmacologicClass**: [`CodedValue`](CodedValue.md) & `object` \| `null`

MED-RT Established Pharmacologic Class of the investigational product,
with the MED-RT release it was taken from. Null when the study names no
investigational product with a class.

***

### phase

> `readonly` **phase**: `string`

Trial phase decode, for example `Phase III Trial`.

***

### phaseCode

> `readonly` **phaseCode**: `string`

Trial phase NCI EVS code.

***

### plannedEnrollment

> `readonly` **plannedEnrollment**: `number`

Planned number of subjects.

***

### schedule

> `readonly` **schedule**: readonly [`ScheduledActivity`](ScheduledActivity.md)[]

Schedule of activities: which activity is planned at which visit.

***

### visits

> `readonly` **visits**: readonly [`VisitDefinition`](VisitDefinition.md)[]

Planned visits, in schedule order.
