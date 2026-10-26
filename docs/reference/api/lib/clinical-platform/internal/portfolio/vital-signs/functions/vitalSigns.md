[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/vital-signs](../README.md) / vitalSigns

# Function: vitalSigns()

> **vitalSigns**(`seed`, `studyId`, `plans`, `sim`): [`EdcVitalSign`](../../../../types/platform/interfaces/EdcVitalSign.md)[]

Draws one study's vital signs. Each subject has a usual value for each
sign, and every entered visit records one reading of each, scattered
around it.

## Parameters

### seed

`number`

Portfolio seed.

### studyId

`string`

The study's id.

### plans

readonly [`SitePlan`](../../sites/interfaces/SitePlan.md)[]

The study's sites.

### sim

[`StudySimulation`](../../records/interfaces/StudySimulation.md)

The study's subjects and visits.

## Returns

[`EdcVitalSign`](../../../../types/platform/interfaces/EdcVitalSign.md)[]

The study's readings, in visit order and then in the order of
  `VITAL_SIGN_MODELS`.
