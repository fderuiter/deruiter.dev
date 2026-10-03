[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/interact](../README.md) / interact

# Function: interact()

> **interact**(`world`, `map?`, `people?`, `handlers?`): [`InteractionOutcome`](../../../types/interfaces/InteractionOutcome.md) \| `null`

Presses E: uses whatever the player is facing. Handlers passed in are
tried first (dialogue, events and site visits plug in here), and the
defaults handle anything they leave alone. Returns null when nothing is
in front of the player. Coffee spends time; looking at a screen is free.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### people?

readonly [`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[] = `[]`

### handlers?

[`InteractionHandlers`](../../../types/interfaces/InteractionHandlers.md) = `{}`

## Returns

[`InteractionOutcome`](../../../types/interfaces/InteractionOutcome.md) \| `null`
