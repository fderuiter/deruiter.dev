[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / createInspectionRound

# Function: createInspectionRound()

> **createInspectionRound**(`records`, `skeletons`, `random`): [`InspectionRound`](../interfaces/InspectionRound.md)

Starts the campaign-finale inspection. The auditor pulls 4-6 of the run's
locked CRFs (fewer only when fewer locked) and asks one question about each,
then one harder question per sponsor skeleton.

## Parameters

### records

readonly [`InspectionRecord`](../interfaces/InspectionRecord.md)[]

The run's locked CRFs.

### skeletons

readonly [`SponsorSkeleton`](../../sponsor/interfaces/SponsorSkeleton.md)[]

Sponsor skeletons taken during the run.

### random

() => `number`

Random source in [0, 1); pass a seeded one.

## Returns

[`InspectionRound`](../interfaces/InspectionRound.md)

A fresh round on its first question.
