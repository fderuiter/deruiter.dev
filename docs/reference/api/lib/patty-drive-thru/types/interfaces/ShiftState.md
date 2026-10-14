[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftState

# Interface: ShiftState

## Properties

### config

> `readonly` **config**: [`ShiftConfig`](ShiftConfig.md)

***

### dilemma

> `readonly` **dilemma**: [`OpenDilemma`](OpenDilemma.md) \| `null`

The dilemma waiting for an answer, or null.

***

### dilemmaChoices

> `readonly` **dilemmaChoices**: readonly [`DilemmaChoice`](DilemmaChoice.md)[]

Every dilemma answered so far, oldest first.

***

### draws

> `readonly` **draws**: `number`

How many random draws this shift has consumed.

***

### lastActionAt

> `readonly` **lastActionAt**: `number`

Shift time of the player's last valid action.

***

### meters

> `readonly` **meters**: [`Meters`](Meters.md)

***

### nextArrivalAt

> `readonly` **nextArrivalAt**: `number`

Shift time at which the next order arrives.

***

### nextOrderId

> `readonly` **nextOrderId**: `number`

***

### orders

> `readonly` **orders**: readonly [`Order`](Order.md)[]

***

### outcome

> `readonly` **outcome**: [`ShiftOutcome`](../type-aliases/ShiftOutcome.md)

***

### pos

> `readonly` **pos**: [`PosCursor`](PosCursor.md)

***

### solidarity

> `readonly` **solidarity**: `number`

The hidden Solidarity value (#2087), 0 to 100: how far the player has
stood with the crew. Dilemmas move it; the booth never shows it.

***

### tallies

> `readonly` **tallies**: [`ShiftTallies`](ShiftTallies.md)

***

### time

> `readonly` **time**: `number`

Shift time in seconds, always between 0 and durationSec.

***

### wipeReadyAt

> `readonly` **wipeReadyAt**: `number`

Shift time before which the player cannot wipe again.
