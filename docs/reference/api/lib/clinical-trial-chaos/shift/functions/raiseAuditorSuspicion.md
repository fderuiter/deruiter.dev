[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / raiseAuditorSuspicion

# Function: raiseAuditorSuspicion()

> **raiseAuditorSuspicion**(`auditor`, `delta`): [`AuditorState`](../../types/interfaces/AuditorState.md)

Raises auditor suspicion after a mistake, capped at 100. The auditor turns
suspicious, or starts writing a Form 483 once suspicion reaches 100.

## Parameters

### auditor

[`AuditorState`](../../types/interfaces/AuditorState.md)

The auditor before the mistake.

### delta

`number`

Suspicion to add, in percentage points.

## Returns

[`AuditorState`](../../types/interfaces/AuditorState.md)

The updated auditor.
