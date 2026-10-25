[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / PipelineOptions

# Interface: PipelineOptions

## Properties

### nSubjects

> `readonly` **nSubjects**: `number`

Number of synthetic subjects to generate.

***

### scenarios?

> `readonly` `optional` **scenarios?**: readonly [`ScenarioId`](../type-aliases/ScenarioId.md)[]

Messy-data scenarios to layer onto the collected data (#2605). Omitted
or empty, the run is exactly the generated study.

***

### seed

> `readonly` **seed**: `number`

PRNG seed, a non-negative 32-bit integer.
