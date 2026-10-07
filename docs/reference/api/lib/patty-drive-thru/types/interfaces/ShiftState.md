[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftState

# Interface: ShiftState

## Properties

### config

> `readonly` **config**: [`ShiftScenarioConfig`](ShiftScenarioConfig.md)

***

### draws

> `readonly` **draws**: `number`

How many random draws this shift has consumed.

***

### history?

> `readonly` `optional` **history?**: readonly [`ShiftActionEntry`](ShiftActionEntry.md)[]

Recorded action history for replay and telemetry export.

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
