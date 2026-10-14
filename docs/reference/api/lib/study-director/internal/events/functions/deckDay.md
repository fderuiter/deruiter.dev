[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / deckDay

# Function: deckDay()

> **deckDay**(`state`, `event`): `number` \| `null`

The first day an event can reach this run's inbox on its own, or null when
it never does: a follow-up or wildcard (those arrive only when scheduled),
or an event this run's deck did not draw. A run without a deck, as every
save from before #2093, keeps each event on its written day.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### event

[`StudyEvent`](../../../types/interfaces/StudyEvent.md)

## Returns

`number` \| `null`
