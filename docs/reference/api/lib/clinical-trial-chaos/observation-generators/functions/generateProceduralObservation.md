[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/observation-generators](../README.md) / generateProceduralObservation

# Function: generateProceduralObservation()

> **generateProceduralObservation**(`request`): [`ClinicalObservation`](../../types/interfaces/ClinicalObservation.md) \| `null`

Generates a flagged observation for `field`: a plausible true value with
one data-entry error applied. The options hold the correct value and three
distractors derived from the same true value, and the AST rule accepts
only the correct value. Returns `null` when the field has no generator or
the requested kind does not apply to it.

## Parameters

### request

[`ProceduralObservationRequest`](../interfaces/ProceduralObservationRequest.md)

## Returns

[`ClinicalObservation`](../../types/interfaces/ClinicalObservation.md) \| `null`
