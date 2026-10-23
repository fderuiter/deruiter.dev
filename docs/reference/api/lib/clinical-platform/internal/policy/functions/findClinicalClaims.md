[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/internal/policy](../README.md) / findClinicalClaims

# Function: findClinicalClaims()

> **findClinicalClaims**(`text`): [`PolicyFinding`](../../../types/interfaces/PolicyFinding.md)[]

Finds clinical compliance claims that no synthetic demo can make, such as
"CDASH 2.2 compliant", "100% Compliant" or "immutable audit trail". The
sanctioned disclaimers are removed first, as in `checkRegulatoryWording`.

## Parameters

### text

`string`

Copy or source text to check.

## Returns

[`PolicyFinding`](../../../types/interfaces/PolicyFinding.md)[]

One finding per matched phrase, grouped by phrase rule.
