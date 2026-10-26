[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/adverse-events](../README.md) / adverseEvents

# Function: adverseEvents()

> **adverseEvents**(`seed`, `studyId`, `plans`, `sim`): [`EdcAdverseEvent`](../../../../types/platform/interfaces/EdcAdverseEvent.md)[]

Draws one study's adverse events. Each entered visit of an enrolled
subject on or after enrollment reports a Poisson number of events, each
beginning up to four weeks before the visit but not before enrollment,
and reported the day the site entered the visit's data.

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

[`EdcAdverseEvent`](../../../../types/platform/interfaces/EdcAdverseEvent.md)[]

The study's adverse events, in visit order.
