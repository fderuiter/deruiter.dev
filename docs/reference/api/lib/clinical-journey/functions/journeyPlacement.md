[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/clinical-journey](../README.md) / journeyPlacement

# Function: journeyPlacement()

> **journeyPlacement**(`path`): \{ `isStep`: `boolean`; `step`: [`ClinicalJourneyStep`](../interfaces/ClinicalJourneyStep.md); \} \| `null`

The step a page belongs to: the step it is, or the step a related case
study illustrates.

## Parameters

### path

`string`

A site path such as `/study-data` or `/case-studies/crf-xl`.

## Returns

\{ `isStep`: `boolean`; `step`: [`ClinicalJourneyStep`](../interfaces/ClinicalJourneyStep.md); \} \| `null`

The step and whether the page is the step itself, or null when
  the page is not part of the journey.
