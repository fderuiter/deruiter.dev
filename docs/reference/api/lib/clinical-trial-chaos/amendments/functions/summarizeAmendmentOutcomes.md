[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / summarizeAmendmentOutcomes

# Function: summarizeAmendmentOutcomes()

> **summarizeAmendmentOutcomes**(`state`): [`AmendmentOutcome`](../../types/interfaces/AmendmentOutcome.md)[]

Every outcome for the report, including rules still open when the shift
ended.

## Parameters

### state

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects at the end of the shift.

## Returns

[`AmendmentOutcome`](../../types/interfaces/AmendmentOutcome.md)[]

Outcomes in the order they ended, open rules last.
