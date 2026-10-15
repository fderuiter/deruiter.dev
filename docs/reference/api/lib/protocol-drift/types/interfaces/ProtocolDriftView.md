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

### assisted

> **assisted**: `boolean`

True once the run has loaded a reference pipeline (#2168).

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

### nextEventMinute

> **nextEventMinute**: `number` \| `null`

The minute of the next event a player would notice (data arriving, a
site reply, the memo or a wave's end), or null when none is scheduled.
Skip to next event advances the clock to it (#2170).

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

### rejectedCommands

> **rejectedCommands**: `number`

Commands turned down so far that count against the scorecard.

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
