[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/pipeline](../README.md) / PipelineRunResult

# Interface: PipelineRunResult

Everything one pipeline run produced.

## Properties

### dispatched

> **dispatched**: [`PipelinePacket`](../../../types/interfaces/PipelinePacket.md)[]

***

### held

> **held**: [`HeldDraft`](HeldDraft.md)[]

***

### issues

> **issues**: [`IssueDraft`](IssueDraft.md)[]

***

### mh

> **mh**: [`MhDraft`](../../../types/interfaces/MhDraft.md)[]

***

### observations

> **observations**: [`ObservationDraft`](../../../types/interfaces/ObservationDraft.md)[]

***

### regexSplitUsed

> **regexSplitUsed**: `boolean`

***

### routing

> **routing**: [`RoutingRecord`](../../../types/interfaces/RoutingRecord.md) \| `null`

***

### unmatched

> **unmatched**: `object`[]

#### issue

> **issue**: [`IssueDraft`](IssueDraft.md)

#### nodeId

> **nodeId**: `string`

#### text

> **text**: `string`
