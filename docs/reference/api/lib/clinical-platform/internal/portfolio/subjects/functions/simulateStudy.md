[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/subjects](../README.md) / simulateStudy

# Function: simulateStudy()

> **simulateStudy**(`seed`, `study`, `sites`, `asOfDay`, `pace`): [`StudySimulation`](../../records/interfaces/StudySimulation.md)

Simulates one study's subjects and their records.

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

### asOfDay

`number`

Day number of the data cut.

### pace

`number`

Study-wide multiplier on screening rates.

## Returns

[`StudySimulation`](../../records/interfaces/StudySimulation.md)
