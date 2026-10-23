[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/operations](../README.md) / studyOperations

# Function: studyOperations()

> **studyOperations**(`seed`, `study`, `sites`, `sim`, `startDay`, `asOfDay`): [`StudyOperations`](../interfaces/StudyOperations.md)

Builds the study-level operational records.

## Parameters

### seed

`number`

Portfolio seed.

### study

[`StudyBlueprint`](../../blueprint/interfaces/StudyBlueprint.md)

Study blueprint.

### sites

readonly [`SitePlan`](../../sites/interfaces/SitePlan.md)[]

The study's planned sites.

### sim

[`StudySimulation`](../../records/interfaces/StudySimulation.md)

The study's subject simulation.

### startDay

`number`

Day number of the study start.

### asOfDay

`number`

Day number of the data cut.

## Returns

[`StudyOperations`](../interfaces/StudyOperations.md)
