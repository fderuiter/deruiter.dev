[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/amendments](../README.md) / recordAmendmentLock

# Function: recordAmendmentLock()

> **recordAmendmentLock**(`state`): `object`

Records a CRF lock. While a double-signature audit is open the lock counts
as countersigned; the audit closes once its CRFs are all done.

## Parameters

### state

[`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)

The effects in force.

## Returns

`object`

The new effects and whether this lock closed the audit.

### auditClosed

> **auditClosed**: `boolean`

### state

> **state**: [`AmendmentEffectsState`](../interfaces/AmendmentEffectsState.md)
