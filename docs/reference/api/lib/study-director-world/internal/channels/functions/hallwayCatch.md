[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / hallwayCatch

# Function: hallwayCatch()

> **hallwayCatch**(`world`, `people`): \{ `eventId`: `string`; `memberId`: `string`; \} \| `null`

A team member near the player who has a message they have not raised yet:
they stop you, in the corridor or anywhere else on the floor. Null when
nobody is waiting within two tiles.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### people

readonly [`PersonPlacement`](../../../types/interfaces/PersonPlacement.md)[]

## Returns

\{ `eventId`: `string`; `memberId`: `string`; \} \| `null`
