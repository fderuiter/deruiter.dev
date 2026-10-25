[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/forecast/simulate](../README.md) / simulateEnrollmentCompletion

# Function: simulateEnrollmentCompletion()

> **simulateEnrollmentCompletion**(`input`): `number`[]

Simulates the time to enroll the remaining subjects.

## Parameters

### input

[`EnrollmentSimulationInput`](../../../../types/interfaces/EnrollmentSimulationInput.md)

The sites, the later sites, the subjects still to enroll, the runs and the stream key.

## Returns

`number`[]

Each run's completion time in days from the start, sorted ascending.

## Throws

RangeError when the input is outside its domain.
