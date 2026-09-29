[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / getObservationChoices

# Function: getObservationChoices()

> **getObservationChoices**(`observation`): `string`[]

The choices the fix dialog offers for an observation. An empty or missing
option list falls back to the expected value and the raw entry, so the
dialog never opens without a button to press.

Authored and generated option lists put the correct value first, so the
choices are shuffled. The shuffle is seeded by the observation, which keeps
the order (and so the 1-4 hotkeys) stable while a dialog is open and across
server and client renders, but varies it from one observation to the next.

## Parameters

### observation

[`ClinicalObservation`](../../types/interfaces/ClinicalObservation.md)

## Returns

`string`[]
