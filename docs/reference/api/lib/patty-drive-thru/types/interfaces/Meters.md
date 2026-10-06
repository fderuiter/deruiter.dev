[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / Meters

# Interface: Meters

The meters the player is managing. Standing meters die at 0; idle dies at 100.

## Properties

### dignity

> `readonly` **dignity**: `number`

What is left of the player's dignity. 0 ends the shift as a breakdown.

***

### idle

> `readonly` **idle**: `number`

How long the manager has watched the player standing idle.

***

### sos

> `readonly` **sos**: `number`

Drive-thru standing with the manager and corporate. 0 ends the shift as docked.
