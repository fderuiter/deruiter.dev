[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / PosCursor

# Interface: PosCursor

Where the player is in the POS menu tree.

## Properties

### activeOrderId

> `readonly` **activeOrderId**: `number` \| `null`

The order the next ring-up lands on, or null when none is selected.

***

### path

> `readonly` **path**: readonly `string`[]

Node ids from the root to the open screen; empty means the home screen.

***

### taps

> `readonly` **taps**: `number`

Taps spent since the last completed ring-up, for telemetry and UI.
