[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getAmendmentIntervalSeconds

# Function: getAmendmentIntervalSeconds()

> **getAmendmentIntervalSeconds**(`phase`, `auditYear?`): `number`

Seconds between random protocol amendments in a phase, before the office
adjusts it. Endless Audit Years shorten it further (#2053).

## Parameters

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

The running phase.

### auditYear?

`number` = `1`

The endless Audit Year; 1 leaves the phase rate.

## Returns

`number`

40, 28 or 20 seconds in year 1, less in later years.
