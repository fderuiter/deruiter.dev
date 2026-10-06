[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / PosNode

# Interface: PosNode

A node in the deliberately clunky POS menu tree.

## Properties

### children?

> `readonly` `optional` **children?**: readonly `PosNode`[]

***

### id

> `readonly` **id**: `string`

***

### itemId?

> `readonly` `optional` **itemId?**: [`MenuItemId`](../type-aliases/MenuItemId.md)

Set on leaves that ring up a menu item.

***

### label

> `readonly` **label**: `string`

***

### modifierId?

> `readonly` `optional` **modifierId?**: `"no-pickles"`

Set on leaves that ring up a modifier.
