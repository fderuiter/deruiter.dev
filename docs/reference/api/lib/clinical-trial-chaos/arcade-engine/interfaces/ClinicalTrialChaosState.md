[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/arcade-engine](../README.md) / ClinicalTrialChaosState

# Interface: ClinicalTrialChaosState

## Properties

### activeAmendment

> **activeAmendment**: [`ProtocolAmendment`](../../types/interfaces/ProtocolAmendment.md) \| `null`

***

### activeProtocol

> **activeProtocol**: [`StudyProtocol`](../../../crf/types/interfaces/StudyProtocol.md) \| `null`

***

### auditLogs

> **auditLogs**: [`AuditLogEntry`](../../types/interfaces/AuditLogEntry.md)[]

***

### auditorState

> **auditorState**: [`AuditorState`](../../types/interfaces/AuditorState.md)

***

### isManualOpen

> **isManualOpen**: `boolean`

The Field Manual is open, which holds the clocks still (#1672).

***

### isModalPaused

> **isModalPaused**: `boolean`

***

### isPaused

> **isPaused**: `boolean`

***

### powerUps

> **powerUps**: [`PowerUpInventory`](../../types/type-aliases/PowerUpInventory.md)

***

### ruleViolations

> **ruleViolations**: [`RecordedRuleViolation`](../../types/interfaces/RecordedRuleViolation.md)[]

***

### scoreState

> **scoreState**: [`GameScoreState`](../../types/interfaces/GameScoreState.md)

***

### stressParams

> **stressParams**: [`StressParameters`](../../types/interfaces/StressParameters.md)

***

### subjects

> **subjects**: [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]

***

### submittedHistory

> **submittedHistory**: [`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)[]
