[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / beginStudy

# Function: beginStudy()

> **beginStudy**(`state`, `options?`): [`StudyState`](../../../types/interfaces/StudyState.md)

Starts the study on day 1 with its event deck dealt, its wildcards drawn
and the first inbox ready. The office passes `openers` so its first day
varies by seed (#2254); the classic desk keeps its one-message first day,
which teaches auditing once the inbox is empty.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### options?

[`DeckOptions`](../interfaces/DeckOptions.md) = `{}`

## Returns

[`StudyState`](../../../types/interfaces/StudyState.md)
