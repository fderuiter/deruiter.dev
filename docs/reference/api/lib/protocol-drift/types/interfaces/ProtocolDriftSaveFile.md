[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / ProtocolDriftSaveFile

# Interface: ProtocolDriftSaveFile

Versioned save file (pd-101-save-v1.json).

## Properties

### adamLedger

> **adamLedger**: [`ADaMVitalSignRecord`](ADaMVitalSignRecord.md)[]

***

### auditTrail

> **auditTrail**: [`AuditTrailEvent`](AuditTrailEvent.md)[]

***

### clock

> **clock**: `object`

#### isPaused

> **isPaused**: `boolean`

#### minute

> **minute**: `number`

#### speed

> **speed**: [`SimSpeed`](../type-aliases/SimSpeed.md)

***

### commands

> **commands**: [`PDCommand`](../type-aliases/PDCommand.md)[]

The ordered command log; replaying it rebuilds the run exactly.

***

### format

> **format**: `"pd-101-save-v1"`

***

### fsmState

> **fsmState**: [`SimulationState`](../type-aliases/SimulationState.md)

***

### graph

> **graph**: [`PipelineGraph`](PipelineGraph.md)

***

### mhLedger

> **mhLedger**: [`SDTMMedicalHistoryRecord`](SDTMMedicalHistoryRecord.md)[]

***

### queries

> **queries**: [`ClinicalQuery`](ClinicalQuery.md)[]

***

### savedAt

> **savedAt**: `string`

***

### scenario

> **scenario**: [`ScenarioId`](../type-aliases/ScenarioId.md)

***

### sdtmLedger

> **sdtmLedger**: [`SDTMVitalSignRecord`](SDTMVitalSignRecord.md)[]

***

### seed

> **seed**: `number`

***

### sites

> **sites**: `Record`\<`string`, \{ `attention`: `number`; `goodwill`: `number`; `version`: [`ProtocolVersion`](../type-aliases/ProtocolVersion.md); \}\>

***

### stateHash

> **stateHash**: `string`

Hash of the ledgers, checked after replay on import.

***

### version

> **version**: `1`
