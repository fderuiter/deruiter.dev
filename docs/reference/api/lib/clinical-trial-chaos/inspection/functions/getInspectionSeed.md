[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / getInspectionSeed

# Function: getInspectionSeed()

> **getInspectionSeed**(`records`): `number`

The seed for a run's inspection, hashed from the run's own locked records,
so the same run always draws the same questions. Pass it to
`createSeededRandom` from `lib/game-utils`.

## Parameters

### records

readonly [`InspectionRecord`](../interfaces/InspectionRecord.md)[]

The run's locked CRFs.

## Returns

`number`

A 32-bit seed.
