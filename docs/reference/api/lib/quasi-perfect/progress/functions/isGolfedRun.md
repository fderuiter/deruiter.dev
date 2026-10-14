[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/progress](../README.md) / isGolfedRun

# Function: isGolfedRun()

> **isGolfedRun**(`steps`, `par`, `usedSorry`): `boolean`

Whether a finished run earns the Golfed badge: an honest proof in no more
tactics than the level's par (#2059). A run on a level without a par
never earns it.

## Parameters

### steps

`number`

Tactics the run applied.

### par

`number` \| `null`

The level's step par, or null when it has none.

### usedSorry

`boolean`

Whether the run admitted any goal with `sorry`.

## Returns

`boolean`

True when the run is golfed.
