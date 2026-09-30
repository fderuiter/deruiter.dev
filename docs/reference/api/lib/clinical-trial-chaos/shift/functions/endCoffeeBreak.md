[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / endCoffeeBreak

# Function: endCoffeeBreak()

> **endCoffeeBreak**(`auditor`): [`AuditorState`](../../types/interfaces/AuditorState.md)

Brings the auditor back from a coffee break. The auditor resumes patrol
even when a wrong fix during the break made it suspicious, because that
auditor is still paused and would otherwise stay frozen for the rest of the
shift (#1610). An auditor already writing a Form 483 is left as it is: the
shift is ending.

## Parameters

### auditor

[`AuditorState`](../../types/interfaces/AuditorState.md)

The auditor when the break runs out.

## Returns

[`AuditorState`](../../types/interfaces/AuditorState.md)

The auditor back on patrol.
