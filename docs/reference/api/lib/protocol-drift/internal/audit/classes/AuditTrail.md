[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/audit](../README.md) / AuditTrail

# Class: AuditTrail

An append-only, frozen audit log.

## Constructors

### Constructor

> **new AuditTrail**(): `AuditTrail`

#### Returns

`AuditTrail`

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Number of entries.

##### Returns

`number`

## Methods

### append()

> **append**(`minute`, `draft`): [`AuditTrailEvent`](../../../types/interfaces/AuditTrailEvent.md)

Appends a frozen entry stamped with the clock minute.

#### Parameters

##### minute

`number`

##### draft

[`AuditDraft`](../type-aliases/AuditDraft.md)

#### Returns

[`AuditTrailEvent`](../../../types/interfaces/AuditTrailEvent.md)

***

### list()

> **list**(): readonly [`AuditTrailEvent`](../../../types/interfaces/AuditTrailEvent.md)[]

A read-only view of every entry in order.

#### Returns

readonly [`AuditTrailEvent`](../../../types/interfaces/AuditTrailEvent.md)[]
