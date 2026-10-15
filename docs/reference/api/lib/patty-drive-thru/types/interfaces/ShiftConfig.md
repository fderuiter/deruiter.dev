[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / ShiftConfig

# Interface: ShiftConfig

The dials a named scenario turns. Every one is optional and falls back to
the standard shift's value; the engine clamps whatever it is given.

## Extends

- [`ShiftScenario`](ShiftScenario.md)

## Properties

### ageUnlocked?

> `readonly` `optional` **ageUnlocked?**: `boolean`

True once the player is eighteen, so age-locked items ring up (#2086).

***

### arrivalGapMaxSec?

> `readonly` `optional` **arrivalGapMaxSec?**: `number`

Longest gap between car arrivals, in seconds.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`arrivalGapMaxSec`](ShiftScenario.md#arrivalgapmaxsec)

***

### arrivalGapMinSec?

> `readonly` `optional` **arrivalGapMinSec?**: `number`

Shortest gap between car arrivals, in seconds.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`arrivalGapMinSec`](ShiftScenario.md#arrivalgapminsec)

***

### dilemmaDeck?

> `readonly` `optional` **dilemmaDeck?**: readonly [`DilemmaId`](../type-aliases/DilemmaId.md)[]

The dilemmas this shift puts to the player, in order (#2139). A week
deals each day its own so no dilemma repeats; left out, the shift draws
from every dilemma a single shift can.

***

### dilemmaWindowSec?

> `readonly` `optional` **dilemmaWindowSec?**: `number`

Seconds the player has to answer a dilemma (#2087). Left out, the usual
window; the booth passes a longer one for players who ask for more time.

***

### dispenserFailChance?

> `readonly` `optional` **dispenserFailChance?**: `number`

Chance the drink dispenser drops a drink, from 0 to 1.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`dispenserFailChance`](ShiftScenario.md#dispenserfailchance)

***

### durationSec

> `readonly` **durationSec**: `number`

Real seconds the shift lasts.

***

### firstArrivalSec?

> `readonly` `optional` **firstArrivalSec?**: `number`

Shift time of the first order, in seconds.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`firstArrivalSec`](ShiftScenario.md#firstarrivalsec)

***

### idleGraceSec?

> `readonly` `optional` **idleGraceSec?**: `number`

Seconds of standing still before the manager starts to notice.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`idleGraceSec`](ShiftScenario.md#idlegracesec)

***

### idleRatePerSec?

> `readonly` `optional` **idleRatePerSec?**: `number`

Idle meter points gained per second once the grace period is over.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`idleRatePerSec`](ShiftScenario.md#idleratepersec)

***

### rushWindows?

> `readonly` `optional` **rushWindows?**: readonly [`RushWindow`](../type-aliases/RushWindow.md)[]

The shift's rushes (#2086). Left out, a standard shift has the one lunch
rush and a scenario that sets its own arrival gaps has none; an empty
list means no rush at all.

***

### seed

> `readonly` **seed**: `string`

Any string; the same seed and actions replay to the same shift.

***

### sosGainFast?

> `readonly` `optional` **sosGainFast?**: `number`

Standing gained when a fast order is bumped.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`sosGainFast`](ShiftScenario.md#sosgainfast)

***

### sosGainOnTime?

> `readonly` `optional` **sosGainOnTime?**: `number`

Standing gained when an on-time order is bumped.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`sosGainOnTime`](ShiftScenario.md#sosgainontime)

***

### sosLossExpired?

> `readonly` `optional` **sosLossExpired?**: `number`

Standing lost when an order expires.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`sosLossExpired`](ShiftScenario.md#soslossexpired)

***

### sosLossLate?

> `readonly` `optional` **sosLossLate?**: `number`

Standing lost when a late order is bumped.

#### Inherited from

[`ShiftScenario`](ShiftScenario.md).[`sosLossLate`](ShiftScenario.md#soslosslate)

***

### startMeters?

> `readonly` `optional` **startMeters?**: [`StartMeters`](StartMeters.md)

Where Dignity and SOS start, carried from the day before (#2086).
