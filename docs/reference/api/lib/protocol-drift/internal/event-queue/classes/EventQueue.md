[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/protocol-drift/internal/event-queue](../README.md) / EventQueue

# Class: EventQueue

A sorted queue of pending events.

## Constructors

### Constructor

> **new EventQueue**(): `EventQueue`

#### Returns

`EventQueue`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Number of pending events.

##### Returns

`number`

## Methods

### peek()

> **peek**(): [`SimEvent`](../interfaces/SimEvent.md) \| `undefined`

The next event, without removing it.

#### Returns

[`SimEvent`](../interfaces/SimEvent.md) \| `undefined`

***

### pop()

> **pop**(): [`SimEvent`](../interfaces/SimEvent.md) \| `undefined`

Removes and returns the next event.

#### Returns

[`SimEvent`](../interfaces/SimEvent.md) \| `undefined`

***

### push()

> **push**(`minute`, `priority`, `kind`, `ref`): [`SimEvent`](../interfaces/SimEvent.md)

Schedules an event and returns it.

#### Parameters

##### minute

`number`

##### priority

`number`

##### kind

[`SimEventKind`](../type-aliases/SimEventKind.md)

##### ref

`string`

#### Returns

[`SimEvent`](../interfaces/SimEvent.md)

***

### toArray()

> **toArray**(): [`SimEvent`](../interfaces/SimEvent.md)[]

A copy of the pending events in run order.

#### Returns

[`SimEvent`](../interfaces/SimEvent.md)[]
