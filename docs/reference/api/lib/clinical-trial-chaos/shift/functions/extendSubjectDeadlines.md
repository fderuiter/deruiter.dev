[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / extendSubjectDeadlines

# Function: extendSubjectDeadlines()

> **extendSubjectDeadlines**(`subjects`): [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

Site Query Extension: adds 12 seconds to every subject, capped at 10
seconds over its full time.

## Parameters

### subjects

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

The conveyor queue.

## Returns

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

The queue with extended deadlines.
