[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / ProtocolDriftView

# Interface: ProtocolDriftView

A read-only copy of the engine state, for tests, the inspector and saves.

## Properties

### adamRows

> **adamRows**: [`ADaMVitalSignRecord`](ADaMVitalSignRecord.md)[]

***

### amendmentAnnounced

> **amendmentAnnounced**: `boolean`

***

### attentionLog

> **attentionLog**: [`AttentionStep`](AttentionStep.md)[]

***

### auditTrail

> **auditTrail**: [`AuditTrailEvent`](AuditTrailEvent.md)[]

***

### completedWaves

> **completedWaves**: [`WaveIndex`](../type-aliases/WaveIndex.md)[]

***

### debt

> **debt**: [`DebtSummary`](DebtSummary.md)

***

### draftGraph

> **draftGraph**: [`PipelineGraph`](PipelineGraph.md)

***

### fsmState

> **fsmState**: [`SimulationState`](../type-aliases/SimulationState.md)

***

### held

> **held**: [`HeldPacket`](HeldPacket.md)[]

***

### issues

> **issues**: [`Issue`](Issue.md)[]

***

### lastLockAudit

> **lastLockAudit**: [`LockAuditResult`](LockAuditResult.md) \| `null`

***

### mhLedger

> **mhLedger**: [`SDTMMedicalHistoryRecord`](SDTMMedicalHistoryRecord.md)[]

***

### minute

> **minute**: `number`

***

### publishedGraph

> **publishedGraph**: [`PipelineGraph`](PipelineGraph.md) \| `null`

***

### publishedRevisionId

> **publishedRevisionId**: `string` \| `null`

***

### queries

> **queries**: [`ClinicalQuery`](ClinicalQuery.md)[]

***

### routing

> **routing**: [`RoutingRecord`](RoutingRecord.md)[]

***

### scenario

> **scenario**: [`ScenarioId`](../type-aliases/ScenarioId.md)

***

### seed

> **seed**: `number`

***

### sites

> **sites**: `Record`\<[`SiteId`](../type-aliases/SiteId.md), [`SiteState`](SiteState.md)\>

***

### sourceLedger

> **sourceLedger**: [`SourceRevision`](SourceRevision.md)[]

***

### speed

> **speed**: [`SimSpeed`](../type-aliases/SimSpeed.md)

***

### traceViolations

> **traceViolations**: [`TraceViolation`](TraceViolation.md)[]

***

### unmatched

> **unmatched**: [`UnmatchedEntry`](UnmatchedEntry.md)[]

***

### unpaired

> **unpaired**: [`ADaMVitalSignRecord`](ADaMVitalSignRecord.md)[]

***

### vsLedger

> **vsLedger**: [`SDTMVitalSignRecord`](SDTMVitalSignRecord.md)[]

***

### waveIndex

> **waveIndex**: [`WaveIndex`](../type-aliases/WaveIndex.md)
