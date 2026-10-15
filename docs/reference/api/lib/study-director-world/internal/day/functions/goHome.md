[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/day](../README.md) / goHome

# Function: goHome()

> **goHome**(`world`, `options?`): `object`

The player goes home. Overtime becomes fatigue, and the study simulates
the night: unanswered messages that ran out of time apply their fallout,
the sites and team work through their day, and new messages arrive.
Pass `delegated` when the team ran the day without the player.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### options?

#### delegated?

`boolean`

## Returns

`object`

### report

> **report**: [`OvernightReport`](../../../types/interfaces/OvernightReport.md)

### world

> **world**: [`WorldState`](../../../types/interfaces/WorldState.md)
