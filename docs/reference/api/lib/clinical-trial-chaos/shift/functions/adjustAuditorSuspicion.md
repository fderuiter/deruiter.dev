[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / adjustAuditorSuspicion

# Function: adjustAuditorSuspicion()

> **adjustAuditorSuspicion**(`auditor`, `delta`): [`AuditorState`](../../types/interfaces/AuditorState.md)

Applies a suspicion change that leaves the auditor's behavior alone,
floored at 0. A verified submission uses it with a negative delta.

## Parameters

### auditor

[`AuditorState`](../../types/interfaces/AuditorState.md)

The auditor before the change.

### delta

`number`

Suspicion to add (negative to cool the auditor down).

## Returns

[`AuditorState`](../../types/interfaces/AuditorState.md)

The updated auditor.
