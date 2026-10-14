[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/escalation](../README.md) / getAuditYearEscalation

# Function: getAuditYearEscalation()

> **getAuditYearEscalation**(`year`): [`AuditYearEscalation`](../type-aliases/AuditYearEscalation.md)

How many steps each axis has taken by a given year. Once every station is
open, further station steps tighten the spawn interval instead, so each
year still makes the run harder.

## Parameters

### year

`number`

The Audit Year.

## Returns

[`AuditYearEscalation`](../type-aliases/AuditYearEscalation.md)

Steps per axis.
