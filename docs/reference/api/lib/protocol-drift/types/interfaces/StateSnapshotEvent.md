[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / StateSnapshotEvent

# Interface: StateSnapshotEvent

Snapshot of the live state after every command.

## Properties

### activeSites

> **activeSites**: `Record`\<`string`, \{ `attention`: `number`; `goodwill`: `number`; `latencyHours`: `number`; `openQueries`: `number`; `version`: [`ProtocolVersion`](../type-aliases/ProtocolVersion.md); \}\>

***

### amendmentAnnounced

> **amendmentAnnounced**: `boolean`

***

### clockLabel

> **clockLabel**: `string`

***

### debt

> **debt**: `object`

#### fabricatedBits

> **fabricatedBits**: `number`

#### semanticLossCount

> **semanticLossCount**: `number`

#### uncertainCount

> **uncertainCount**: `number`

***

### fsmState

> **fsmState**: [`SimulationState`](../type-aliases/SimulationState.md)

***

### isPaused

> **isPaused**: `boolean`

***

### minute

> **minute**: `number`

***

### openIssues

> **openIssues**: `number`

***

### openQueries

> **openQueries**: `number`

***

### publishedRevisionId

> **publishedRevisionId**: `string` \| `null`

***

### recordCounts

> **recordCounts**: `object`

#### adamRows

> **adamRows**: `number`

#### sdtmMh

> **sdtmMh**: `number`

#### sdtmVs

> **sdtmVs**: `number`

***

### speed

> **speed**: [`SimSpeed`](../type-aliases/SimSpeed.md)

***

### type

> **type**: `"STATE_SNAPSHOT"`

***

### waveIndex

> **waveIndex**: [`WaveIndex`](../type-aliases/WaveIndex.md)
