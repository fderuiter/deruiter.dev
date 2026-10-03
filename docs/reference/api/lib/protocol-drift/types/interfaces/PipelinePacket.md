[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / PipelinePacket

# Interface: PipelinePacket

A token moving along a wire.

## Properties

### assessedAt

> **assessedAt**: `string`

ISO 8601, e.g. "2025-11-01T09:00:00Z".

***

### epistemicBadges

> **epistemicBadges**: [`EpistemicStatus`](../type-aliases/EpistemicStatus.md)[]

***

### fabricatedBits

> **fabricatedBits**: `number`

***

### field?

> `optional` **field?**: [`FieldValue`](FieldValue.md)

***

### formVersion?

> `optional` **formVersion?**: [`ProtocolVersion`](../type-aliases/ProtocolVersion.md)

***

### id

> **id**: `string`

***

### mh?

> `optional` **mh?**: [`MhDraft`](MhDraft.md)

***

### observation?

> `optional` **observation?**: [`ObservationDraft`](ObservationDraft.md)

***

### payload

> **payload**: `Record`\<`string`, `unknown`\>

***

### portType

> **portType**: [`PortType`](../type-aliases/PortType.md)

***

### siteId

> **siteId**: [`SiteId`](../type-aliases/SiteId.md)

***

### sourceNodeId

> **sourceNodeId**: `string`

***

### sourceRevisionId

> **sourceRevisionId**: `string`

***

### subjectId

> **subjectId**: `string`

***

### submissionId

> **submissionId**: `string`

***

### submittedAt

> **submittedAt**: `string`

ISO 8601, e.g. "2025-11-01T09:15:00Z".

***

### targetNodeId?

> `optional` **targetNodeId?**: `string`

***

### trace

> **trace**: `string`[]

Visited node IDs, in order.

***

### visitDay

> **visitDay**: `number`
