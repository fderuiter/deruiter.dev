[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Setup

# Interface: Setup

Everything decided before the clock starts.

## Properties

### assist?

> `readonly` `optional` **assist?**: `boolean`

Solo play only: a deterministic helper moves the partner the player is
not controlling. Co-op ignores it, and it never acts for Fred while away.
Off when absent, so setups saved before the helper existed still load.

***

### capabilities

> `readonly` **capabilities**: readonly [`CapabilityId`](../type-aliases/CapabilityId.md)[]

***

### cart

> `readonly` **cart**: [`Cart`](Cart.md)

***

### relaxed

> `readonly` **relaxed**: `boolean`

Stretches the clock for players who want more time.

***

### seed?

> `readonly` `optional` **seed?**: `number`

The day's seed: 0 (the default, also when absent, so older shared runs
replay unchanged) schedules no events; any other seed schedules a shower
and a guest rush, the same for everyone who has that seed.
