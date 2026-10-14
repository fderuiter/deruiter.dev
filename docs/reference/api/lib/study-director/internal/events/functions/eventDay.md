[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / eventDay

# Function: eventDay()

> **eventDay**(`state`, `event`): `number`

The day an event was written for, on this study's calendar. Event days are
written on the full study's calendar; a short study (#2092) squeezes them
into its own duration, so the story keeps its order and every phase still
gets its messages. A run with a deck (#2093) draws the day it actually
arrives from a window around this one: see [deckDay](deckDay.md).

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### event

[`StudyEvent`](../../../types/interfaces/StudyEvent.md)

## Returns

`number`
