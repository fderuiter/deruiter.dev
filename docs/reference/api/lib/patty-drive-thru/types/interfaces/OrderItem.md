[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / OrderItem

# Interface: OrderItem

One line of an order as the customer speaks it through the headset.

## Properties

### dropped

> `readonly` **dropped**: `boolean`

True when the drink dispenser dropped this drink and it must be re-entered.

***

### itemId

> `readonly` **itemId**: [`MenuItemId`](../type-aliases/MenuItemId.md)

***

### modifier

> `readonly` **modifier**: `"no-pickles"` \| `null`

***

### modifierDone

> `readonly` **modifierDone**: `boolean`

True once the requested modifier was rung up. Always true without one.

***

### rung

> `readonly` **rung**: `boolean`

True once the item was rung up at the POS.
