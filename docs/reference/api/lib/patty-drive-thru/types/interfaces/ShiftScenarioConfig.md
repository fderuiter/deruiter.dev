[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftScenarioConfig

# Interface: ShiftScenarioConfig

## Properties

### arrivalGapMaxSec?

> `readonly` `optional` **arrivalGapMaxSec?**: `number`

Maximum gap between car arrivals in seconds.

***

### arrivalGapMinSec?

> `readonly` `optional` **arrivalGapMinSec?**: `number`

Minimum gap between car arrivals in seconds.

***

### dispenserFailChance?

> `readonly` `optional` **dispenserFailChance?**: `number`

Chance automatic drink dispenser drops drink (0-1).

***

### durationSec

> `readonly` **durationSec**: `number`

Real seconds the shift lasts.

***

### firstArrivalSec?

> `readonly` `optional` **firstArrivalSec?**: `number`

Shift time of first order arrival.

***

### idleGraceSec?

> `readonly` `optional` **idleGraceSec?**: `number`

Seconds of idle before manager notices.

***

### idleRatePerSec?

> `readonly` `optional` **idleRatePerSec?**: `number`

Points gained per second when idle after grace period.

***

### posMenu?

> `readonly` `optional` **posMenu?**: [`PosNode`](PosNode.md)

Custom root node of the POS menu tree.

***

### seed

> `readonly` **seed**: `string`

Any string; the same seed and actions replay to the same shift.

***

### sosGainFast?

> `readonly` `optional` **sosGainFast?**: `number`

Meter gain on fast order bump.

***

### sosGainOnTime?

> `readonly` `optional` **sosGainOnTime?**: `number`

Meter gain on on-time order bump.

***

### sosLossExpired?

> `readonly` `optional` **sosLossExpired?**: `number`

Meter loss on expired order.

***

### sosLossLate?

> `readonly` `optional` **sosLossLate?**: `number`

Meter loss on late order bump.
