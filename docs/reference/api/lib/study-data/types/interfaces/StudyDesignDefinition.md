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

### cells

> `readonly` **cells**: readonly [`StudyCellDefinition`](StudyCellDefinition.md)[]

Arm by epoch study cells.

***

### elements

> `readonly` **elements**: readonly [`ElementDefinition`](ElementDefinition.md)[]

Trial design elements.

***

### epochs

> `readonly` **epochs**: readonly [`EpochDefinition`](EpochDefinition.md)[]

Epochs, in sequence.

***

### estimands

> `readonly` **estimands**: readonly [`EstimandDefinition`](EstimandDefinition.md)[]

Estimands.

***

### model

> `readonly` **model**: `string`

Intervention model decode, for example `Parallel Study`.

***

### objectives

> `readonly` **objectives**: readonly [`ObjectiveDefinition`](ObjectiveDefinition.md)[]

Objectives and their endpoints.

***

### phase

> `readonly` **phase**: `string`

Trial phase decode, for example `Phase III Trial`.

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
