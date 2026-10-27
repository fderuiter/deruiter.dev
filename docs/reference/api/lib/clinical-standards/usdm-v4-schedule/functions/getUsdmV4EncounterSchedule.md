[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-schedule](../README.md) / getUsdmV4EncounterSchedule

# Function: getUsdmV4EncounterSchedule()

> **getUsdmV4EncounterSchedule**(`design`, `anchorDay?`): [`UsdmV4EncounterSchedule`](../interfaces/UsdmV4EncounterSchedule.md)[]

Resolves every encounter on a design's main timeline to a planned study
day and visit window by walking its timings back to the Fixed Reference
anchor, which is placed on `anchorDay` (Day 1 unless told otherwise).
Encounters are returned in the order of the timeline's instances.

## Parameters

### design

`Pick`\<[`UsdmV4InterventionalStudyDesign`](../../usdm-v4-types/interfaces/UsdmV4InterventionalStudyDesign.md), `"scheduleTimelines"`\>

### anchorDay?

`number` = `1`

## Returns

[`UsdmV4EncounterSchedule`](../interfaces/UsdmV4EncounterSchedule.md)[]
