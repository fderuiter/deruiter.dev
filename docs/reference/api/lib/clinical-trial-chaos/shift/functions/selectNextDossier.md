[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / selectNextDossier

# Function: selectNextDossier()

> **selectNextDossier**(`queue`, `submittedId`, `phaseCleared`): [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md) \| `null`

The dossier to load after a submission (#834): the most urgent subject
left in the queue, or none once the phase is cleared.

## Parameters

### queue

readonly [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

The conveyor queue, still holding the submitted subject.

### submittedId

`string`

The subject just submitted.

### phaseCleared

`boolean`

Whether the submission cleared the phase.

## Returns

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md) \| `null`

The next subject, or null.
