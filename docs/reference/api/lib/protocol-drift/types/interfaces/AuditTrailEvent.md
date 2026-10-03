[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/types](../README.md) / AuditTrailEvent

# Interface: AuditTrailEvent

An immutable audit trail entry.

## Properties

### actor

> **actor**: [`AuditActor`](../type-aliases/AuditActor.md)

***

### eventId

> **eventId**: `string`

***

### newValue

> **newValue**: `unknown`

***

### oldValue

> **oldValue**: `unknown`

***

### queryThreadId?

> `optional` **queryThreadId?**: `string`

***

### reason

> **reason**: `string`

***

### subjectId

> **subjectId**: `string`

***

### timestamp

> **timestamp**: `string`

ISO 8601.

***

### trialDay

> **trialDay**: `number`

***

### type

> **type**: [`AuditEventType`](../type-aliases/AuditEventType.md)

***

### variable

> **variable**: `string`

***

### visit

> **visit**: `string`
