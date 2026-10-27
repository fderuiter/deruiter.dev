[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / isEvidenceStale

# Function: isEvidenceStale()

> **isEvidenceStale**(`scenario`, `form`): `boolean`

Whether a scenario's evidence still describes the current form.

Evidence with no run, or produced against a different form revision, is
stale. Stale is not failure: it means the answer is unknown until the
scenario is run again.

## Parameters

### scenario

[`TestScenario`](../../../types/interfaces/TestScenario.md)

### form

[`CRFForm`](../../../types/interfaces/CRFForm.md)

## Returns

`boolean`
