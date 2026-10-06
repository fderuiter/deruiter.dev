[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / KdsTicket

# Interface: KdsTicket

One order as the kitchen display and the POS ticket strip show it.

## Properties

### active

> `readonly` **active**: `boolean`

True when this is the order the POS is ringing up.

***

### ageSec

> `readonly` **ageSec**: `number`

***

### band

> `readonly` **band**: [`KdsBand`](../type-aliases/KdsBand.md)

***

### coworkerReadyIn

> `readonly` **coworkerReadyIn**: `number` \| `null`

Seconds until a flagged coworker is done, or null.

***

### lines

> `readonly` **lines**: readonly [`TicketLine`](TicketLine.md)[]

***

### needsCoworker

> `readonly` **needsCoworker**: `boolean`

True when an age-locked item is waiting and nobody has been flagged.

***

### orderId

> `readonly` **orderId**: `number`

***

### ready

> `readonly` **ready**: `boolean`

True when the order can be bumped.
