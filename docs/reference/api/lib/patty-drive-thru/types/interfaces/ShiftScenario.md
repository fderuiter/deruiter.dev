[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftScenario

# Interface: ShiftScenario

The dials a named scenario turns. Every one is optional and falls back to
the standard shift's value; the engine clamps whatever it is given.

## Extended by

- [`ShiftConfig`](ShiftConfig.md)

## Properties

### arrivalGapMaxSec?

> `readonly` `optional` **arrivalGapMaxSec?**: `number`

Longest gap between car arrivals, in seconds.

***

### arrivalGapMinSec?

> `readonly` `optional` **arrivalGapMinSec?**: `number`

Shortest gap between car arrivals, in seconds.

***

### dispenserFailChance?

> `readonly` `optional` **dispenserFailChance?**: `number`

Chance the drink dispenser drops a drink, from 0 to 1.

***

### firstArrivalSec?

> `readonly` `optional` **firstArrivalSec?**: `number`

Shift time of the first order, in seconds.

***

### idleGraceSec?

> `readonly` `optional` **idleGraceSec?**: `number`

Seconds of standing still before the manager starts to notice.

***

### idleRatePerSec?

> `readonly` `optional` **idleRatePerSec?**: `number`

Idle meter points gained per second once the grace period is over.

***

### sosGainFast?

> `readonly` `optional` **sosGainFast?**: `number`

Standing gained when a fast order is bumped.

***

### sosGainOnTime?

> `readonly` `optional` **sosGainOnTime?**: `number`

Standing gained when an on-time order is bumped.

***

### sosLossExpired?

> `readonly` `optional` **sosLossExpired?**: `number`

Standing lost when an order expires.

***

### sosLossLate?

> `readonly` `optional` **sosLossLate?**: `number`

Standing lost when a late order is bumped.
