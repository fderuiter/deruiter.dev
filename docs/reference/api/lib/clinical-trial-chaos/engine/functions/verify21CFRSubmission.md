[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / verify21CFRSubmission

# Function: verify21CFRSubmission()

> **verify21CFRSubmission**(`subject`, `reason`, `targetStation`): `object`

Evaluates 21 CFR Part 11 Electronic Signature submission.

## Parameters

### subject

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

### reason

`string`

### targetStation

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

## Returns

### level

> **level**: `"WARN"` \| `"CRITICAL"` \| `"COMPLIANT"`

### logMessage

> **logMessage**: `string`

### reasonMismatch?

> `optional` **reasonMismatch?**: `boolean`

Set when the signature reason, not the data or routing, was wrong.

### success

> **success**: `boolean`

### suspicionDelta

> **suspicionDelta**: `number`
