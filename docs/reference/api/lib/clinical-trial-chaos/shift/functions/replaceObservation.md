[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / replaceObservation

# Function: replaceObservation()

> **replaceObservation**(`subjects`, `subjectId`, `observation`): [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

Swaps one observation on one subject for its corrected version.

## Parameters

### subjects

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

The conveyor queue.

### subjectId

`string`

The subject that owns the observation.

### observation

[`ClinicalObservation`](../../types/interfaces/ClinicalObservation.md)

The corrected observation; matched by id.

## Returns

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

A new queue with the observation replaced.
