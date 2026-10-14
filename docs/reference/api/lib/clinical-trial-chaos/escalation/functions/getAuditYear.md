[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/escalation](../README.md) / getAuditYear

# Function: getAuditYear()

> **getAuditYear**(`locks`): `number`

The Audit Year an endless run is in after a number of CRF locks. Year 1
covers the first `AUDIT_YEAR_LOCKS` locks.

## Parameters

### locks

`number`

CRFs locked so far this run.

## Returns

`number`

The Audit Year, starting at 1.
