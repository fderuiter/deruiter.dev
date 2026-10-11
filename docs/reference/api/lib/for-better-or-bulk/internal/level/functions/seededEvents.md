[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/level](../README.md) / seededEvents

# Function: seededEvents()

> **seededEvents**(`seed`, `duration`): readonly [`SeededEvent`](../../../types/interfaces/SeededEvent.md)[]

The seeded events a level schedules. Seed 0 schedules none, so the standard
day is unchanged; any other seed draws one shower and one guest rush from
its own generator, so the same seed always gives the same times.

## Parameters

### seed

`number`

### duration

`number`

## Returns

readonly [`SeededEvent`](../../../types/interfaces/SeededEvent.md)[]
