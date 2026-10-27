[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/study-auditor](../README.md) / StudyAuditReport

# Interface: StudyAuditReport

Global study audit report returned by StudyAuditor.audit().

## Properties

### autoFix

> **autoFix**: (`diagnosticId`) => [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

#### Parameters

##### diagnosticId

`string`

#### Returns

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

***

### autoFixAll

> **autoFixAll**: () => `object`

#### Returns

`object`

##### fixedCount

> **fixedCount**: `number`

##### protocol

> **protocol**: [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

***

### diagnostics

> **diagnostics**: [`AuditDiagnostic`](AuditDiagnostic.md)[]

***

### health

> **health**: [`FormHealthMetrics`](FormHealthMetrics.md)

***

### isCompliant

> **isCompliant**: `boolean`

***

### score

> **score**: `number`

***

### summary

> **summary**: `object`

#### errors

> **errors**: `number`

#### fixable

> **fixable**: `number`

#### infos

> **infos**: `number`

#### warnings

> **warnings**: `number`
