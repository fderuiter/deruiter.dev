[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / drawDeck

# Function: drawDeck()

> **drawDeck**(`state`, `options?`): [`StudyState`](../../../types/interfaces/StudyState.md)

Deals this run's event deck (#2093). Core events are always drawn; of the
optional ones, each stretch of the study keeps [DECK\_KEEP\_SHARE](../variables/DECK_KEEP_SHARE.md) of
what was written for it. Every drawn event gets a day inside its window,
scaled to this study's calendar. A callback is drawn exactly when the
event it recalls is, and always arrives after it. With `openers`, a seeded
pick of gentle openers it dealt into the first fortnight is brought
forward to day 1. The deck uses its own stream of
the seed, so the study's other draws and the wildcards are unchanged.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### options?

[`DeckOptions`](../interfaces/DeckOptions.md) = `{}`

## Returns

[`StudyState`](../../../types/interfaces/StudyState.md)
