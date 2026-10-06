[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / Order

# Interface: Order

## Properties

### arrivedAt

> `readonly` **arrivedAt**: `number`

Shift time in seconds at which the order arrived.

***

### coworkerReadyAt

> `readonly` **coworkerReadyAt**: `number` \| `null`

Shift time at which a flagged coworker can brew this order's coffee, or null.

***

### id

> `readonly` **id**: `number`

***

### items

> `readonly` **items**: readonly [`OrderItem`](OrderItem.md)[]
