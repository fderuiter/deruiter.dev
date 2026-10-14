[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/escalation](../README.md) / getAuditYearSpawnFactor

# Function: getAuditYearSpawnFactor()

> **getAuditYearSpawnFactor**(`year`): `number`

Multiplier on the phase spawn interval for a year: 1 in year 1, smaller as
the spawn axis rises, never below `MIN_SPAWN_FACTOR`.

## Parameters

### year

`number`

The Audit Year.

## Returns

`number`

A factor from 0.35 to 1.
