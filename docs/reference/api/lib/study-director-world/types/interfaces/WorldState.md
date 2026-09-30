[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / WorldState

# Interface: WorldState

The world on top of a study: the clock, the player's energy and focus,
and what the player has learned. The study itself stays authoritative
(ADR 0055) and runs in clock budget mode.

## Properties

### coffees

> **coffees**: `number`

Cups of coffee today.

***

### energy

> **energy**: `number`

0 to 100. Spent by activity, restored overnight.

***

### fatigue

> **fatigue**: `number`

Energy the player could not recover overnight after working late.

***

### focus

> **focus**: `number`

0 to 100. Spent by demanding work, restored overnight and by coffee.

***

### known

> **known**: `string`[]

Facts the player has learned, by id.

***

### location

> **location**: `string`

Where the player is.

***

### minute

> **minute**: `number`

Minutes after midnight.

***

### overtime

> **overtime**: `number`

Minutes worked past the end of the office day, today.

***

### study

> **study**: [`StudyState`](../../../study-director/types/interfaces/StudyState.md)

***

### version

> **version**: `1`
