[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/sponsor](../README.md) / describePhaseClearForm483

# Function: describePhaseClearForm483()

> **describePhaseClearForm483**(`report`, `auditViolations`): `string`[] \| `null`

Explains a phase-clear inspection that still ended in a Form 483. The phase
advances either way; the end panel uses this to own the verdict instead of
claiming the audit passed. Returns `null` unless the verdict is OAI.

## Parameters

### report

[`BIMOInspectionReport`](../../types/interfaces/BIMOInspectionReport.md)

The phase's final inspection report, sponsor skeletons applied.

### auditViolations

`number`

Missed or misrouted CRFs counted during the phase.

## Returns

`string`[] \| `null`

One plain-language line per cause, or `null` for NAI and VAI.
